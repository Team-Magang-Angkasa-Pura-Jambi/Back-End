import type { Response } from "express";

interface ResponseParams<T> {
  res: Response;
  message: string;
  data?: T;
}

export const res200 = <T>({ res, message, data }: ResponseParams<T>) => {
  return res.status(200).json({
    status: {
      code: 200,
      message,
    },
    data,
  });
};

export const res201 = <T>({ res, message, data }: ResponseParams<T>) => {
  return res.status(201).json({
    status: {
      code: 201,
      message,
    },
    data,
  });
};

export const res404 = ({ res, message }: ResponseParams<null>) => {
  return res.status(404).json({
    status: {
      code: 404,
      message,
    },
    data: null,
  });
};

export const res500 = ({ res, message }: ResponseParams<null>) => {
  return res.status(500).json({
    status: {
      code: 500,
      message,
    },
    data: null,
  });
};
