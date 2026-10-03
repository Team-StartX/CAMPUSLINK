export interface DirectoryOption {
  id: string;
  name: string;
  domain?: string;
  country?: string;
  region?: string;
  website?: string;
  source: 'Hipo' | 'Clearbit';
}
export interface DirectoryResponse {
  results: DirectoryOption[];
  unavailable: boolean;
  message: string;
}
