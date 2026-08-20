import os from 'os';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'HTTP' | 'DB';

export interface ServerLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  statusCode?: number;
  durationMs?: number;
  endpoint?: string;
  request?: {
    method: string;
    url: string;
    ip?: string;
    headers?: Record<string, any>;
    query?: Record<string, any>;
    params?: Record<string, any>;
    body?: Record<string, any>;
  };
  response?: {
    statusCode: number;
    durationMs: number;
    body?: any;
  };
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
    meta?: any;
  };
}

export interface ServerSystemMetrics {
  server: {
    node_version: string;
    platform: string;
    arch: string;
    uptime_seconds: number;
    uptime_human: string;
    pid: number;
  };
  memory: {
    rss_mb: number;
    heap_total_mb: number;
    heap_used_mb: number;
    external_mb: number;
    system_free_mb: number;
    system_total_mb: number;
    system_usage_percent: number;
  };
  cpu: {
    cores: number;
    model: string;
    load_avg: number[];
  };
  logs_stats: {
    total: number;
    error_count: number;
    warn_count: number;
    http_count: number;
  };
}

class ServerLoggerService {
  private logs: ServerLogEntry[] = [];
  private maxLogs: number = 1000;
  private logIdCounter: number = 0;

  constructor() {
    this.log('INFO', 'Server Logger Service & System Monitor initialized', 'SystemMonitor', {
      endpoint: '/system-monitor',
    });
  }

  public log(
    level: LogLevel,
    message: string,
    source: string = 'Server',
    extra: Partial<ServerLogEntry> = {},
  ): ServerLogEntry {
    this.logIdCounter++;
    const entry: ServerLogEntry = {
      id: `log_${Date.now()}_${this.logIdCounter}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      ...extra,
    };

    this.logs.unshift(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    return entry;
  }

  public getLogs(filter: {
    level?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): { logs: ServerLogEntry[]; total: number } {
    let filtered = this.logs;

    if (filter.level && filter.level !== 'ALL') {
      const targetLevel = filter.level.toUpperCase();
      filtered = filtered.filter((l) => l.level === targetLevel);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.endpoint?.toLowerCase().includes(q) ||
          l.request?.url?.toLowerCase().includes(q) ||
          l.request?.method?.toLowerCase().includes(q) ||
          l.error?.message?.toLowerCase().includes(q) ||
          l.error?.name?.toLowerCase().includes(q) ||
          l.source?.toLowerCase().includes(q),
      );
    }

    const total = filtered.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    const paginated = filtered.slice(offset, offset + limit);

    return { logs: paginated, total };
  }

  public clearLogs(): void {
    this.logs = [];
    this.log('INFO', 'Server logs buffer cleared by administrator', 'SystemMonitor', {
      endpoint: '/system-monitor/clear-logs',
    });
  }

  public getSystemMetrics(): ServerSystemMetrics {
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);

    const uptimeHuman = `${days > 0 ? `${days}h ` : ''}${hours > 0 ? `${hours}j ` : ''}${mins}m ${secs}d`;

    const mem = process.memoryUsage();
    const totalSysMem = os.totalmem();
    const freeSysMem = os.freemem();
    const usedSysMem = totalSysMem - freeSysMem;

    const cpus = os.cpus();

    const errCount = this.logs.filter((l) => l.level === 'ERROR').length;
    const warnCount = this.logs.filter((l) => l.level === 'WARN').length;
    const httpCount = this.logs.filter((l) => l.level === 'HTTP').length;

    return {
      server: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime_seconds: Math.floor(uptimeSec),
        uptime_human: uptimeHuman,
        pid: process.pid,
      },
      memory: {
        rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        external_mb: Math.round((mem.external / 1024 / 1024) * 10) / 10,
        system_free_mb: Math.round((freeSysMem / 1024 / 1024) * 10) / 10,
        system_total_mb: Math.round((totalSysMem / 1024 / 1024) * 10) / 10,
        system_usage_percent: Math.round((usedSysMem / totalSysMem) * 1000) / 10,
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        load_avg: os.loadavg().map((l) => Math.round(l * 100) / 100),
      },
      logs_stats: {
        total: this.logs.length,
        error_count: errCount,
        warn_count: warnCount,
        http_count: httpCount,
      },
    };
  }
}

export const serverLoggerService = new ServerLoggerService();
