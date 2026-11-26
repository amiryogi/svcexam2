import type { FinalGradeBand, GradeBand, GradingRules } from './types.js';
/**
 * NEB letter grading (Grade 11–12) component scale.
 * Verify against the latest NEB directive before seeding; the API stores these as editable data.
 */
export declare const NEB_GRADE_BANDS: GradeBand[];
/** Final grade from a subject's weighted grade point ("above 3.6 to 4.0 = A+", …, "1.6 = D"). */
export declare const NEB_FINAL_GRADE_BANDS: FinalGradeBand[];
export declare const NEB_RULES: GradingRules;
export declare const NG = "NG";
