export function formatLocalDate(date, options = {}) {
    const defaultOptions = {
      locale: "id-ID",
      timeZone: "Asia/Jakarta",
      dateStyle: "short",
      timeStyle: "medium"
    };
  
    const formatter = new Intl.DateTimeFormat(
      options.locale || defaultOptions.locale,
      {
        ...defaultOptions,
        ...options
      }
    );
  
    return formatter.format(new Date(date));
  }
  