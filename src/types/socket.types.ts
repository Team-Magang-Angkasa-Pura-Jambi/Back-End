// src/socket-types.ts

// src/types/socket.types.ts

// Tipe data untuk payload yang akan kita gunakan
export interface MessagePayload {
  author: string;
  text: string;
}

// BARU: Payload untuk notifikasi umum
export interface NotificationPayload {
  title: string;
  message: string;
  link?: string; // Link opsional untuk di-klik
}

// BARU: Payload untuk notifikasi data yang hilang
export interface MissingDataPayload {
  meterType: string;
  message: string;
  missingDate: string;
}

// Event yang dikirim dari SERVER ke CLIENT
export interface ServerToClientEvents {
  data_reminder: (payload: MissingDataPayload) => void;
  new_notification: (payload: NotificationPayload) => void;
  new_message: (payload: MessagePayload) => void;
  server_info: (data: { version: string }) => void;
  new_notification_available: () => void;

  // BARU: Event untuk progres kalkulasi ulang
  'recalculation:progress': (payload: { processed: number; total: number }) => void;
  'recalculation:success': (payload: { message: string }) => void;
  'recalculation:error': (payload: { message: string }) => void;
}

// Event yang dikirim dari CLIENT ke SERVER
export interface ClientToServerEvents {
  send_message: (payload: MessagePayload) => void;

  // PERBAIKAN: Pindahkan join_room ke sini karena dikirim dari client
  join_room: (userId: string) => void;
}
