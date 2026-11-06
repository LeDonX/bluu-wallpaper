import { promises as dns } from 'node:dns';
import net from 'node:net';
import tls from 'node:tls';

export interface TlsCertificateInfo {
  subjectCn: string | null;
  subjectAltNames: string | null;
}

/** DNS 诊断使用系统解析；应用内 hostmap 由 Chromium 注入，不在此处生效（DR-067） */
export async function resolveHost(host: string): Promise<string[]> {
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

/** TCP 443 直连探测；target 可能是映射 IP，也可能是域名 */
export function tcpProbe(target: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: target, port: 443 });
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error === undefined) resolve();
      else reject(error);
    };

    socket.setTimeout(timeoutMs, () => {
      finish(new Error('连接超时'));
    });
    socket.once('connect', () => {
      finish();
    });
    socket.once('error', (error) => {
      finish(error);
    });
  });
}

/** TLS 握手探测：`servername` 使用站点域名，`target` 使用映射 IP 时可避免证书校验错配 */
export function tlsProbe(
  target: string,
  servername: string,
  timeoutMs: number
): Promise<TlsCertificateInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({
      host: target,
      port: 443,
      servername,
      rejectUnauthorized: true
    });
    let settled = false;

    const finish = (error?: Error, info?: TlsCertificateInfo): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error !== undefined) reject(error);
      else resolve(info ?? { subjectCn: null, subjectAltNames: null });
    };

    socket.setTimeout(timeoutMs, () => {
      finish(new Error('TLS 握手超时'));
    });
    socket.once('secureConnect', () => {
      try {
        const certificate = socket.getPeerCertificate();
        const cn = certificate.subject['CN'];
        const altNames = certificate.subjectaltname;
        finish(undefined, {
          subjectCn: Array.isArray(cn) ? cn[0] ?? null : cn ?? null,
          subjectAltNames: Array.isArray(altNames) ? altNames.join(', ') : altNames ?? null
        });
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.once('error', (error) => {
      finish(error);
    });
  });
}
