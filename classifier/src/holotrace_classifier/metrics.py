"""Classification and detection metrics, implemented directly in torch to keep the math visible."""

import torch
from torchvision.ops import box_iou


def confusion_matrix(preds: torch.Tensor, targets: torch.Tensor, num_classes: int) -> torch.Tensor:
    """Rows are true labels, columns are predictions."""
    index = targets * num_classes + preds
    return torch.bincount(index, minlength=num_classes**2).reshape(num_classes, num_classes)


def classification_report(cm: torch.Tensor, labels: tuple[str, ...]) -> dict:
    cm = cm.double()
    tp = cm.diag()
    support, predicted = cm.sum(1), cm.sum(0)
    precision = tp / predicted.clamp(min=1)
    recall = tp / support.clamp(min=1)
    f1 = 2 * precision * recall / (precision + recall).clamp(min=1e-12)
    present = support > 0
    per_class = {
        labels[i]: {
            "precision": precision[i].item(),
            "recall": recall[i].item(),
            "f1": f1[i].item(),
            "support": int(support[i].item()),
        }
        for i in range(len(labels))
        if support[i] > 0 or predicted[i] > 0
    }
    return {
        "accuracy": (tp.sum() / cm.sum().clamp(min=1)).item(),
        # Macro F1 over labels that occur, so each symbol counts equally regardless of frequency
        "macro_f1": f1[present].mean().item() if present.any() else 0.0,
        "per_class": per_class,
    }


def _voc_ap(recall: torch.Tensor, precision: torch.Tensor) -> float:
    """Area under the precision envelope (all-point interpolation, as in PASCAL VOC 2010+)."""
    mrec = torch.cat([torch.tensor([0.0]), recall, torch.tensor([1.0])])
    mpre = torch.cat([torch.tensor([0.0]), precision, torch.tensor([0.0])])
    mpre = torch.flip(torch.cummax(torch.flip(mpre, [0]), 0).values, [0])
    changed = torch.nonzero(mrec[1:] != mrec[:-1]).squeeze(1)
    return float(((mrec[changed + 1] - mrec[changed]) * mpre[changed + 1]).sum())


def detection_ap(
    predictions: list[dict[str, torch.Tensor]],
    ground_truth: list[dict[str, torch.Tensor]],
    labels: tuple[str, ...],
    iou_threshold: float = 0.5,
) -> dict:
    """Per-class AP at one IoU threshold plus their mean. Index 0 (background) is skipped."""
    per_class = {}
    for c in range(1, len(labels)):
        scores, hits, num_gt = [], [], 0
        for pred, gt in zip(predictions, ground_truth, strict=True):
            gt_boxes = gt["boxes"][gt["labels"] == c]
            mask = pred["labels"] == c
            p_boxes, p_scores = pred["boxes"][mask], pred["scores"][mask]
            num_gt += len(gt_boxes)
            if len(p_boxes) == 0:
                continue
            order = p_scores.argsort(descending=True)
            p_boxes, p_scores = p_boxes[order], p_scores[order]
            matched = torch.zeros(len(gt_boxes), dtype=torch.bool)
            ious = box_iou(p_boxes, gt_boxes) if len(gt_boxes) else None
            for j in range(len(p_boxes)):
                hit = False
                if ious is not None:
                    best_iou, best = ious[j].max(0)
                    # Greedy matching by score; a second detection of the same symbol is a false positive
                    if best_iou >= iou_threshold and not matched[best]:
                        matched[best] = True
                        hit = True
                scores.append(p_scores[j].item())
                hits.append(hit)
        if num_gt == 0:
            continue
        if not scores:
            per_class[labels[c]] = {"ap": 0.0, "num_gt": num_gt}
            continue
        order = torch.tensor(scores).argsort(descending=True)
        tp = torch.tensor(hits, dtype=torch.double)[order]
        tp_cum, fp_cum = tp.cumsum(0), (1 - tp).cumsum(0)
        recall = tp_cum / num_gt
        precision = tp_cum / (tp_cum + fp_cum)
        per_class[labels[c]] = {"ap": _voc_ap(recall, precision), "num_gt": num_gt}

    aps = [v["ap"] for v in per_class.values()]
    return {"map": sum(aps) / len(aps) if aps else 0.0, "iou_threshold": iou_threshold, "per_class": per_class}
