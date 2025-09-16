// Tipe data untuk Body saat membuat EnergyType baru
export type CreateEnergyTypeBody = {
  type_name: string;
  unit_of_measurement: string;
};

// Tipe data untuk Body saat memperbarui EnergyType
export type UpdateEnergyTypeBody = Partial<CreateEnergyTypeBody>;

// Tipe data untuk Params saat mengambil/memperbarui/menghapus by ID
export type EnergyTypeParams = {
  id: string;
};
