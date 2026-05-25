const MONGO_ID = /^[a-f\d]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (res, message) =>
  res.status(422).json({ success: false, message });

exports.validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name || !String(name).trim()) return fail(res, 'Name is required');
  if (!email || !EMAIL_RE.test(email)) return fail(res, 'Valid email is required');
  if (!password || String(password).length < 6) return fail(res, 'Password must be at least 6 characters');
  next();
};

exports.validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !EMAIL_RE.test(email)) return fail(res, 'Valid email is required');
  if (!password || !String(password).trim()) return fail(res, 'Password is required');
  next();
};

exports.validateService = (req, res, next) => {
  const { name, price, internalCost } = req.body;
  if (!name || !String(name).trim()) return fail(res, 'Service name is required');
  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0)
    return fail(res, 'Price must be a non-negative number');
  if (internalCost !== undefined && internalCost !== null && (isNaN(Number(internalCost)) || Number(internalCost) < 0))
    return fail(res, 'Internal cost must be a non-negative number');
  next();
};

exports.validateOrder = (req, res, next) => {
  const { services } = req.body;
  if (!Array.isArray(services) || services.length === 0)
    return fail(res, 'At least one service is required');
  if (!services.every((id) => MONGO_ID.test(id)))
    return fail(res, 'Each service must be a valid ID');
  next();
};

exports.validateAssign = (req, res, next) => {
  const { employeeId } = req.body;
  if (!employeeId || !MONGO_ID.test(employeeId))
    return fail(res, 'Valid employee ID is required');
  next();
};

exports.validateStatus = (req, res, next) => {
  const { status } = req.body;
  if (!['in_progress', 'completed'].includes(status))
    return fail(res, 'Status must be in_progress or completed');
  next();
};

exports.validateExpense = (req, res, next) => {
  const { title, amount, type } = req.body;
  if (!title || !String(title).trim()) return fail(res, 'Title is required');
  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0)
    return fail(res, 'Amount must be a non-negative number');
  if (!['payroll', 'subscription', 'tooling', 'marketing', 'other'].includes(type))
    return fail(res, 'Invalid expense type');
  next();
};

exports.validateInvite = (req, res, next) => {
  const { email, name, departments } = req.body;
  if (!email || !EMAIL_RE.test(email)) return fail(res, 'Valid email is required');
  if (!name || !String(name).trim()) return fail(res, 'Name is required');
  const validDepts = ['Creative', 'Strategy', 'Media Buying'];
  if (!Array.isArray(departments) || departments.length === 0 || !departments.every((d) => validDepts.includes(d)))
    return fail(res, 'At least one valid department is required (Creative, Strategy, Media Buying)');
  next();
};

exports.validateEmployeeRegister = (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !String(token).trim()) return fail(res, 'Invite token is required');
  if (!password || String(password).length < 6) return fail(res, 'Password must be at least 6 characters');
  next();
};
