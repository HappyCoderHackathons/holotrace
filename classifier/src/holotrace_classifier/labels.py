"""Symbol label set shared by the crop classifier and the detector.

Index order is part of every checkpoint. Changing it (adding, removing, or reordering names) requires bumping
LABEL_SET_VERSION and retraining. Index 0 is background, which matches the torchvision detection convention and
lets the crop classifier reject proposals that are not symbols.

Names follow the CGHD taxonomy (https://github.com/DFKI/cghd/blob/main/classes.json) so public data maps directly.
"""

LABEL_SET_VERSION = "cghd-v0"

BACKGROUND = "background"

LABELS: tuple[str, ...] = (
    BACKGROUND,
    "text",
    "junction",
    "crossover",
    "terminal",
    "gnd",
    "vss",
    "voltage.dc",
    "voltage.ac",
    "voltage.battery",
    "resistor",
    "resistor.adjustable",
    "resistor.photo",
    "capacitor.unpolarized",
    "capacitor.polarized",
    "inductor",
    "transformer",
    "diode",
    "diode.light_emitting",
    "diode.thyrector",
    "diode.zener",
    "diac",
    "triac",
    "thyristor",
    "varistor",
    "transistor.bjt",
    "transistor.fet",
    "transistor.photo",
    "operational_amplifier",
    "operational_amplifier.schmitt_trigger",
    "optocoupler",
    "integrated_circuit",
    "integrated_circuit.ne555",
    "integrated_circuit.voltage_regulator",
    "xor",
    "and",
    "or",
    "not",
    "nand",
    "nor",
    "probe.current",
    "probe.voltage",
    "switch",
    "relay",
    "socket",
    "fuse",
    "speaker",
    "motor",
    "lamp",
    "microphone",
    "antenna",
    "crystal",
)

LABEL_TO_INDEX: dict[str, int] = {name: i for i, name in enumerate(LABELS)}
