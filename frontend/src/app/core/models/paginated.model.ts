export interface PaginatedResponse<T> {
  pagina: number;
  limite: number;
  total: number;
  items: T[];
}
