import type { industries, productFamilies } from "./domain";
export type Industry = (typeof industries)[number];
export type ProductFamily = (typeof productFamilies)[number];
