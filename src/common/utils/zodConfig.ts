import { z } from 'zod';

export const configureZod = () => {
  z.config({
    customError: (issue: any) => {
      if (issue.code === 'invalid_type' && issue.input === undefined) {
        return 'Wajib diisi';
      }

      if (issue.code === 'invalid_type') {
        return `Tipe data salah. Seharusnya: ${issue.expected}`;
      }

      if (issue.code === 'too_small') {
        const min = issue.minimum;
        if (issue.type === 'string') return `Minimal ${min} karakter`;
        if (issue.type === 'number') return `Minimal bernilai ${min}`;
        return `Minimal harus ${min}`;
      }

      if (issue.code === 'too_big') {
        const max = issue.maximum;
        if (issue.type === 'string') return `Maksimal ${max} karakter`;
        if (issue.type === 'number') return `Maksimal bernilai ${max}`;
        return `Maksimal harus ${max}`;
      }

      if (issue.code === 'invalid_string' || issue.code === 'invalid_format') {
        if (issue.validation === 'email') return 'Format email tidak valid';
        if (issue.validation === 'url') return 'Format URL tidak valid';
        return 'Format tidak valid';
      }

      if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_value') {
        const options = issue.options ? issue.options.join(', ') : '';
        return `Nilai tidak valid. Pilihan: ${options}`;
      }

      return undefined;
    },
  });
};
