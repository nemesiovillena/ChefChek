import { redirect } from 'next/navigation';

/** Empleados vive ahora en Personal → Empleados (personas, puestos y fichas). */
export default function CheckInEmployeesRedirect() {
  redirect('/dashboard/users');
}
