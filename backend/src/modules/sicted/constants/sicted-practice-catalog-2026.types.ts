/** Forma de cada buena práctica del catálogo SICTED 2026 (seed autogenerado). */
export interface SictedPracticeSeed2026 {
  code: string;
  chapter: "INTERSECTORIAL" | "OFICIO" | "COMPLEMENTARIO";
  axis: "ECONOMICO" | "SOCIAL" | "AMBIENTAL";
  moduleCode: string;
  moduleName: string;
  title: string;
  isMandatory: boolean;
  isEssential: boolean;
  description: string | null;
  requiresDocs: boolean;
  requiredDocs: string | null;
  templates: string | null;
  relatedCodes: string[];
  notApplicableWhen: string[];
  ods: string | null;
}
