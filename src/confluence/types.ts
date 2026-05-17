interface ConfluenceLinks {
  readonly base?: string;
  readonly context?: string;
  readonly self?: string;
  readonly next?: string;
  readonly prev?: string;
  readonly collection?: string;
  readonly [key: string]: unknown;
}

export interface ConfluencePaginatedResponse<T> {
  readonly results: T[];
  readonly start?: number;
  readonly limit?: number;
  readonly size: number;
  readonly totalSize?: number;
  readonly _links?: ConfluenceLinks;
  readonly [key: string]: unknown;
}

export interface ConfluenceSpace {
  readonly id?: number;
  readonly key: string;
  readonly name?: string;
  readonly type?: string;
  readonly status?: string;
  readonly [key: string]: unknown;
}

interface ConfluenceContentVersion {
  readonly number: number;
  readonly minorEdit?: boolean;
  readonly message?: string;
  readonly [key: string]: unknown;
}

export interface ConfluenceContent {
  readonly id: string;
  readonly type: string;
  readonly status?: string;
  readonly title?: string;
  readonly space?: ConfluenceSpace;
  readonly version?: ConfluenceContentVersion;
  readonly body?: Record<string, unknown>;
  readonly _links?: ConfluenceLinks;
  readonly [key: string]: unknown;
}

export interface ConfluenceLabel {
  readonly prefix?: string;
  readonly name: string;
  readonly id?: string;
  readonly label?: string;
  readonly [key: string]: unknown;
}
