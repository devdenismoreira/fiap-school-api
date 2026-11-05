export type HealthView = Readonly<{ status: 'ok' | 'indisponivel' }>;

export function healthView(databaseAvailable: boolean): HealthView {
  return { status: databaseAvailable ? 'ok' : 'indisponivel' };
}
