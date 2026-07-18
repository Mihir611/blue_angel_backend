const axios = require('axios');
const FormData = require('form-data');

exports.uploadServiceBillFiles = async ({ files, userId, bikeId, serviceDate, bikeName }) => {
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('bikeId', bikeId.toString());
    formData.append('serviceDate', serviceDate);
    formData.append('bikeName', bikeName);

    files.forEach((file) => {
        formData.append('files',file.buffer, file.originalname);
    });

    const response = await axios.post(process.env.SUPPORTING_BILL_APU_URL,formData, {
        headers: formData.getHeaders(),
        timeout: 30000
    });

    return response.data.files
};

exports.parseBillDate = (dateStr) => {
  // Expecting DD-MM-YY from frontend
  const match = /^(\d{2})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const [, dd, mm, yy] = match;
  const year = 2000 + parseInt(yy, 10); // adjust if you need to support pre-2000
  const parsed = new Date(Date.UTC(year, parseInt(mm, 10) - 1, parseInt(dd, 10)));

  return isNaN(parsed.getTime()) ? null : parsed;
}