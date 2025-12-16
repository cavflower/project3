import api from './api';

/**
 * 排班管理相關 API
 */

/**
 * 取得所有排班資料（包含 shifts 和 staff）
 * @returns {Promise}
 */
export const getScheduleData = () => {
  return api.get('/schedules/shifts/save_all/');
};

/**
 * 批次儲存所有排班資料
 * @param {Object} data - 包含 shifts 和 staff 的資料
 * @returns {Promise}
 */
export const saveScheduleData = (data) => {
  return api.post('/schedules/shifts/save_all/', data);
};

/**
 * 取得所有員工
 * @returns {Promise}
 */
export const getStaff = () => {
  return api.get('/schedules/staff/');
};

/**
 * 建立員工
 * @param {Object} staffData - 員工資料
 * @returns {Promise}
 */
export const createStaff = (staffData) => {
  return api.post('/schedules/staff/', staffData);
};

/**
 * 更新員工
 * @param {number} id - 員工 ID
 * @param {Object} staffData - 員工資料
 * @returns {Promise}
 */
export const updateStaff = (id, staffData) => {
  return api.patch(`/schedules/staff/${id}/`, staffData);
};

/**
 * 刪除員工
 * @param {number} id - 員工 ID
 * @returns {Promise}
 */
export const deleteStaff = (id) => {
  return api.delete(`/schedules/staff/${id}/`);
};

/**
 * 取得所有排班
 * @returns {Promise}
 */
export const getShifts = () => {
  return api.get('/schedules/shifts/');
};

/**
 * 建立排班
 * @param {Object} shiftData - 排班資料
 * @returns {Promise}
 */
export const createShift = (shiftData) => {
  return api.post('/schedules/shifts/', shiftData);
};

/**
 * 更新排班
 * @param {number} id - 排班 ID
 * @param {Object} shiftData - 排班資料
 * @returns {Promise}
 */
export const updateShift = (id, shiftData) => {
  return api.patch(`/schedules/shifts/${id}/`, shiftData);
};

/**
 * 刪除排班
 * @param {number} id - 排班 ID
 * @returns {Promise}
 */
export const deleteShift = (id) => {
  return api.delete(`/schedules/shifts/${id}/`);
};

/**
 * 匯出班表為 CSV
 * @returns {Promise}
 */
export const exportScheduleCSV = () => {
  return api.get('/schedules/shifts/export_csv/', {
    responseType: 'blob',
  });
};

/**
 * 員工排班申請相關 API
 */

/**
 * 獲取員工所屬公司的店家列表
 * @returns {Promise}
 */
export const getCompanyStores = () => {
  return api.get('/schedules/employee-requests/company_stores/');
};

/**
 * 提交員工排班申請
 * @param {Object} requestData - 申請資料
 * @returns {Promise}
 */
export const submitScheduleRequest = (requestData) => {
  return api.post('/schedules/employee-requests/', requestData);
};

/**
 * 獲取員工的所有申請
 * @returns {Promise}
 */
export const getMyScheduleRequests = () => {
  return api.get('/schedules/employee-requests/my_requests/');
};

/**
 * 獲取店家的所有員工申請（店家端）
 * @returns {Promise}
 */
export const getEmployeeRequests = () => {
  return api.get('/schedules/employee-requests/');
};

/**
 * 刪除員工申請
 * @param {number} id - 申請 ID
 * @returns {Promise}
 */
export const deleteScheduleRequest = (id) => {
  return api.delete(`/schedules/employee-requests/${id}/`);
};

