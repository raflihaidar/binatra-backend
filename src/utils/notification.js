// Helper function untuk create notification
export const createNotification = (type, data) => {
    const baseNotification = {
      id: `${type}-${Date.now()}`,
      type: type,
      timestamp: new Date().toISOString(),
      ...data
    };
  
    return baseNotification;
};