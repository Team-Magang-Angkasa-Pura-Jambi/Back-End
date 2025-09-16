export type CreateReadingDetailBody = {
  reading_type_id: number;
  value: number;
};
export type ReadingDetailCreateInput = {
  reading_type_id: number;
  value: number;
};

export type ReadingSessionCreateInput = {
  meter_id: number;
  user_id: number;
  timestamp: Date;
  details: ReadingDetailCreateInput[];
};

export type CreateReadingSessionBody = {
  meter_id: number;
  user_id: number;
  timestamp: Date;
  details: CreateReadingDetailBody[];
};

export type IdParams = {
  id: string;
};
