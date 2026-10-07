/**
 * Tipos de ausencia con los que arranca cada tenant. Se siembran la primera
 * vez que se consultan y a partir de ahí son suyos: puede renombrarlos,
 * desactivarlos o añadir otros.
 */
export const DEFAULT_ABSENCE_TYPES = [
  {
    name: "Vacaciones",
    color: "#2563eb",
    deductsVacation: true,
    isPaid: true,
    employeeCanRequest: true,
  },
  {
    name: "Asuntos propios",
    color: "#7c3aed",
    deductsVacation: false,
    isPaid: true,
    employeeCanRequest: true,
  },
  {
    name: "Permiso retribuido",
    color: "#0d9488",
    deductsVacation: false,
    isPaid: true,
    employeeCanRequest: true,
  },
  {
    name: "Baja médica",
    color: "#dc2626",
    deductsVacation: false,
    isPaid: true,
    employeeCanRequest: false,
  },
  {
    name: "Ausencia no justificada",
    color: "#6b7280",
    deductsVacation: false,
    isPaid: false,
    employeeCanRequest: false,
  },
];
