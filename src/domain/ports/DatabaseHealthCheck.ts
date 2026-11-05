export interface DatabaseHealthCheck {
  isAvailable(): Promise<boolean>;
}
