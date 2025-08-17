export const DEFAULT_PROCESSOR = process.env.DEFAULT ?? "http://localhost:8001";
export const FALLBACK_PROCESSOR = process.env.FALLBACK ?? "http://localhost:8002";

let processor = DEFAULT_PROCESSOR;
let isMonitoringDefaultProcessor = false;

/**
 * @param {number} timeout 
 */
export function monitorDefaultProcessor(timeout) {
  if (isMonitoringDefaultProcessor && timeout == 0) {
    return;
  }

  isMonitoringDefaultProcessor = true;

  setTimeout(async () => {
    const status = await checkHealth(DEFAULT_PROCESSOR);
    if (!status.failing) {
      processor = DEFAULT_PROCESSOR;
      isMonitoringDefaultProcessor = false;
      return;
    }

    monitorDefaultProcessor(status.minResponseTime);
  }, timeout);
}

export function getBestProcessor() {
  return processor;
}

export function getAltProcessor() {
  if (processor == DEFAULT_PROCESSOR) {
    return FALLBACK_PROCESSOR;
  } else {
    return DEFAULT_PROCESSOR;
  }
}

/**
 * @param {string} url 
 */
export function setProcessor(url) {
  processor = url;
}

/**
 * @param {string} processor 
 * @returns {Promise<{ failing: boolean; minResponseTime: number }>}
 */
export async function checkHealth(processor) {
  const route = "/payments/service-health";
  const res = await fetch(processor + route);

  if (res.status == 200) {
    return await res.json();
  } else {
    return await new Promise((resolve) => {
      setTimeout(() => resolve(checkHealth(processor)), 1000);
    });
  }
}