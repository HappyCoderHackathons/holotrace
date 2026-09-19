"""Provisional request/response contract between the client's local OpenCV pass and this recognition stage.

PROVISIONAL: the client input reference has not been defined yet. Field names and semantics here are a placeholder
so the models can be exercised end to end; align them with the client reference and bump SCHEMA_VERSION when it
lands. All boxes are [x0, y0, x1, y1] in pixel coordinates of the uploaded image.
"""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = "recognition-v0"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class BoundingBox(_Strict):
    x0: float = Field(ge=0)
    y0: float = Field(ge=0)
    x1: float
    y1: float

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.x1 <= self.x0 or self.y1 <= self.y0:
            raise ValueError("box must satisfy x1 > x0 and y1 > y0")
        return self

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.x0, self.y0, self.x1, self.y1)


class RegionProposal(_Strict):
    """A candidate symbol region found by the client's local OpenCV pass."""

    id: str = Field(min_length=1, max_length=64)
    box: BoundingBox
    local_label: str | None = None
    local_confidence: float | None = Field(default=None, ge=0, le=1)


class RecognitionRequest(_Strict):
    schema_version: Literal["recognition-v0"]
    client_preprocess_version: str = Field(min_length=1, max_length=64)
    image_width: int = Field(gt=0)
    image_height: int = Field(gt=0)
    regions: list[RegionProposal] = Field(default_factory=list, max_length=2048)

    @model_validator(mode="after")
    def _regions_in_bounds(self) -> Self:
        for region in self.regions:
            if region.box.x1 > self.image_width or region.box.y1 > self.image_height:
                raise ValueError(f"region {region.id!r} extends beyond the image")
        if len({r.id for r in self.regions}) != len(self.regions):
            raise ValueError("region ids must be unique")
        return self


class LabelScore(_Strict):
    label: str
    confidence: float


class RegionPrediction(_Strict):
    region_id: str
    label: str
    confidence: float
    alternatives: list[LabelScore]
    local_label: str | None


class Detection(_Strict):
    box: BoundingBox
    label: str
    confidence: float


class RecognitionResult(_Strict):
    """Raw recognition output. Not yet a circuit: normalization into Circuit IR happens downstream."""

    schema_version: Literal["recognition-v0"] = SCHEMA_VERSION
    label_set_version: str
    preprocess_version: str
    client_preprocess_version: str
    classifier_version: str | None
    detector_version: str | None
    regions: list[RegionPrediction]
    detections: list[Detection]
