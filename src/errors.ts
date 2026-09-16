export class WoodpeckerApiError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;

  constructor(status: number, method: string, path: string, message: string) {
    super(message);
    this.name = "WoodpeckerApiError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}
