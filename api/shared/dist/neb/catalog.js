const s = (grade, familyCode, name, category, thCode, [thCh, inCh], [thFm, inFm]) => ({
    grade,
    familyCode,
    name,
    category,
    th: { code: thCode, creditHour: thCh, fullMark: thFm },
    // NEB internal (IN) code = theory code + 1, as printed on grade sheets (0011 / 0012).
    in: { code: String(Number(thCode) + 1).padStart(thCode.length, '0'), creditHour: inCh, fullMark: inFm },
});
const STD = [[3.75, 1.25], [75, 25]];
const LAB = [[2.5, 2.5], [50, 50]];
/**
 * NEB subject codes (2078 curriculum) for the subjects this school offers.
 * Grade 11 codes come from the school's own grade sheets; Grade 12 theory codes from NEB's
 * Grade 12 examination routine 2083 (internal code = theory + 1). Credit hours / full marks follow
 * the NEB Grade 11–12 structure. Admins can still edit any value under Setup → Subjects.
 */
export const NEB_SUBJECT_CATALOG = [
    // Grade 11
    s(11, 'NEP', 'Comp. Nepali', 'COMPULSORY', '0011', [2.25, 0.75], [75, 25]),
    s(11, 'ENG', 'Comp. English', 'COMPULSORY', '0031', [3, 1], [75, 25]),
    s(11, 'SOC', 'Comp. Soc. Std. & life Skill', 'COMPULSORY', '0051', ...STD),
    s(11, 'MATH', 'Comp. Mathematics', 'COMPULSORY', '0071', ...STD),
    s(11, 'PHY', 'Physics', 'OPTIONAL', '1011', ...STD),
    s(11, 'ACC', 'Accounting', 'OPTIONAL', '1031', ...STD),
    s(11, 'BIO', 'Biology', 'OPTIONAL', '2011', ...STD),
    s(11, 'BUS', 'Business Studies', 'OPTIONAL', '2151', ...STD),
    s(11, 'CHEM', 'Chemistry', 'OPTIONAL', '3011', ...STD),
    s(11, 'ECO', 'Economics', 'OPTIONAL', '3031', ...STD),
    s(11, 'CS', 'Computer Science', 'OPTIONAL', '4271', ...LAB),
    s(11, 'HM', 'Hotel Management', 'OPTIONAL', '4391', ...LAB),
    // Grade 12
    s(12, 'NEP', 'Comp. Nepali', 'COMPULSORY', '0021', [2.25, 0.75], [75, 25]),
    s(12, 'ENG', 'Comp. English', 'COMPULSORY', '0041', [3, 1], [75, 25]),
    s(12, 'SOC', 'Comp. Soc. Std. & life Skill', 'COMPULSORY', '0061', ...STD),
    s(12, 'MATH', 'Comp. Mathematics', 'COMPULSORY', '0081', ...STD),
    s(12, 'PHY', 'Physics', 'OPTIONAL', '1021', ...STD),
    s(12, 'ACC', 'Accounting', 'OPTIONAL', '1041', ...STD),
    s(12, 'BIO', 'Biology', 'OPTIONAL', '2021', ...STD),
    s(12, 'BUS', 'Business Studies', 'OPTIONAL', '2161', ...STD),
    s(12, 'CHEM', 'Chemistry', 'OPTIONAL', '3021', ...STD),
    s(12, 'ECO', 'Economics', 'OPTIONAL', '3041', ...STD),
    s(12, 'CS', 'Computer Science', 'OPTIONAL', '4281', ...LAB),
    s(12, 'HM', 'Hotel Management', 'OPTIONAL', '4401', ...LAB),
];
export const catalogSubject = (grade, familyCode) => NEB_SUBJECT_CATALOG.find((c) => c.grade === grade && c.familyCode === familyCode);
//# sourceMappingURL=catalog.js.map