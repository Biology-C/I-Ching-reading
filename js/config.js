/**
 * 網站服務設定。
 * gaMeasurementId 填入 GA4 Measurement ID 後，完整漏斗事件會同步送到 GA4。
 * feedbackEndpoint 可填入接受 JSON POST 的 Formspree 或自有端點；留空時改用寄信備援。
 */
window.YI_CONFIG = Object.freeze({
  gaMeasurementId: '',
  feedbackEndpoint: '',
  feedbackEmail: 'h000312@gmail.com'
});
