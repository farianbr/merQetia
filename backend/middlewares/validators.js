const MONGO_ID = /^[a-f\d]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bounds on questionnaire answers. These feed the AI summary, so they're our
// first line of defence against oversized / abusive payloads.
const MAX_ANSWER_LEN = 1000;          // per individual answer
const MAX_ANSWERS_PER_SERVICE = 30;   // distinct questions per service
const MAX_TOTAL_ANSWER_CHARS = 8000;  // across the whole order

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
  const { services, answers } = req.body;
  if (!Array.isArray(services) || services.length === 0)
    return fail(res, 'At least one service is required');
  if (!services.every((id) => MONGO_ID.test(id)))
    return fail(res, 'Each service must be a valid ID');

  // Answers are optional, but when present they're tightly bounded — they get
  // assembled into an AI prompt, so we cap size and reject unexpected shapes.
  if (answers !== undefined && answers !== null) {
    if (typeof answers !== 'object' || Array.isArray(answers))
      return fail(res, 'Answers must be an object keyed by service ID');

    const serviceSet = new Set(services);
    let totalChars = 0;

    for (const [serviceId, serviceAnswers] of Object.entries(answers)) {
      if (!MONGO_ID.test(serviceId) || !serviceSet.has(serviceId))
        return fail(res, 'Answers reference an unknown service');
      if (typeof serviceAnswers !== 'object' || serviceAnswers === null || Array.isArray(serviceAnswers))
        return fail(res, 'Each service\'s answers must be an object');

      const entries = Object.entries(serviceAnswers);
      if (entries.length > MAX_ANSWERS_PER_SERVICE)
        return fail(res, `A service has too many answers (max ${MAX_ANSWERS_PER_SERVICE})`);

      for (const [, value] of entries) {
        if (typeof value !== 'string')
          return fail(res, 'Each answer must be text');
        if (value.length > MAX_ANSWER_LEN)
          return fail(res, `An answer is too long (max ${MAX_ANSWER_LEN} characters)`);
        totalChars += value.length;
      }
    }

    if (totalChars > MAX_TOTAL_ANSWER_CHARS)
      return fail(res, `Answers are too long overall (max ${MAX_TOTAL_ANSWER_CHARS} characters)`);
  }

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
  if (amount !== undefined && amount !== null && (isNaN(Number(amount)) || Number(amount) < 0))
    return fail(res, 'Amount must be a non-negative number');
  if (!['payroll', 'subscription', 'one-time', 'tooling', 'marketing', 'other'].includes(type))
    return fail(res, 'Invalid expense type');
  next();
};

exports.validateTransaction = (req, res, next) => {
  const { amount } = req.body;
  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0)
    return fail(res, 'Amount must be a non-negative number');
  next();
};

exports.validateInvite = (req, res, next) => {
  const { email, departments } = req.body;
  if (!email || !EMAIL_RE.test(email)) return fail(res, 'Valid email is required');
  // Departments are managed dynamically — accept any non-empty set of names.
  // (Name is collected when the employee completes registration.)
  if (!Array.isArray(departments) || departments.length === 0 || !departments.every((d) => String(d).trim()))
    return fail(res, 'At least one department is required');
  next();
};

exports.validateEmployeeRegister = (req, res, next) => {
  const { token, password } = req.body;
  if (!token || !String(token).trim()) return fail(res, 'Invite token is required');
  if (!password || String(password).length < 6) return fail(res, 'Password must be at least 6 characters');
  next();
};
