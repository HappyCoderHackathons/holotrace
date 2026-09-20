// The one place the dev page and the scripts import OpenCV from, so that the app, the dev page and the
// scripts all share a single instance of opencv-ts (objects from two copies cannot be mixed).

import cv from "opencv-ts";

export type { Mat } from "opencv-ts";
export default cv;
