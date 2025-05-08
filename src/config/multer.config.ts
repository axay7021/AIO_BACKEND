import { diskStorage, Options } from 'multer';
import { Request } from 'express';

type File = {
  originalname: string;
};

export const MulterConfig: Options = {
  storage: diskStorage({
    destination: './uploads',
    filename: (
      req: Request,
      file: File,
      callback: (error: Error | null, filename: string) => void,
    ): void => {
      // Replace spaces with underscores in filename
      callback(null, file.originalname?.replace(/ /g, '_'));
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
};
