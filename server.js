import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Schemas
const tenantSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  eidNumber: String,
  unit: { type: String, required: true },
  building: { type: String, required: true },
  leaseStart: { type: String, required: true },
  leaseEnd: { type: String, required: true },
  rentAmount: { type: Number, required: true },
  securityDeposit: { type: Number, default: 0 },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  month: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  method: String,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  dateReported: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const problemFixSchema = new mongoose.Schema({
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  fixedBy: { type: String, required: true },
  dateFixed: { type: String, required: true },
  cost: { type: Number, default: 0 },
  timeRequired: String,
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Tenant = mongoose.model('Tenant', tenantSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Problem = mongoose.model('Problem', problemSchema);
const ProblemFix = mongoose.model('ProblemFix', problemFixSchema);

// API Routes

// Tenants
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = new Tenant(req.body);
    await tenant.save();
    res.status(201).json(tenant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Payments
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await Payment.find().populate('tenantId').sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Problems
app.get('/api/problems', async (req, res) => {
  try {
    const problems = await Problem.find().populate('tenantId').sort({ createdAt: -1 });
    res.json(problems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/problems', async (req, res) => {
  try {
    const problem = new Problem(req.body);
    await problem.save();
    res.status(201).json(problem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Problem Fixes
app.get('/api/problem-fixes', async (req, res) => {
  try {
    const fixes = await ProblemFix.find()
      .populate('problemId')
      .populate('tenantId')
      .sort({ createdAt: -1 });
    res.json(fixes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/problem-fixes', async (req, res) => {
  try {
    const fix = new ProblemFix(req.body);
    await fix.save();
    
    // Mark problem as resolved
    await Problem.findByIdAndUpdate(req.body.problemId, { resolved: true });
    
    res.status(201).json(fix);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Dashboard Stats
app.get('/api/stats', async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeLeases = await Tenant.countDocuments({
      leaseEnd: { $gte: new Date().toISOString().split('T')[0] }
    });
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = await Payment.aggregate([
      { $match: { month: currentMonth } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const openProblems = await Problem.countDocuments({ resolved: false });
    
    res.json({
      totalTenants,
      activeLeases,
      monthlyRevenue: monthlyRevenue[0]?.total || 0,
      openProblems
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
