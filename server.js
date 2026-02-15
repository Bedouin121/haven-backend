import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Validate environment variables
const requiredEnvVars = ['DB_USERNAME', 'DB_PASSWORD', 'DB_CLUSTER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('📝 Please create a .env file in the haven-backend directory with the following variables:');
  console.error('   DB_USERNAME=your_mongodb_username');
  console.error('   DB_PASSWORD=your_mongodb_password');
  console.error('   DB_CLUSTER=your_cluster.mongodb.net');
  console.error('   DB_NAME=haven');
  console.error('\n💡 You can copy .env.example to .env and fill in your MongoDB credentials.');
  process.exit(1);
}

// MongoDB Connection
const MONGO_URI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Check your MongoDB credentials in the .env file');
    console.error('   2. Ensure your IP address is whitelisted in MongoDB Atlas');
    console.error('   3. Verify your cluster URL is correct');
    console.error('   4. Check if your MongoDB Atlas cluster is running');
    process.exit(1);
  });

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

// Root route - Health check
app.get('/', (req, res) => {
  res.json({
    message: '🏠 Tenant Management API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      tenants: '/api/tenants',
      payments: '/api/payments',
      problems: '/api/problems',
      fixes: '/api/problem-fixes',
      stats: '/api/stats'
    }
  });
});

// Tenants
app.get('/api/tenants', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { unit: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { building: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const tenants = await Tenant.find(query).sort({ createdAt: -1 });
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
    
    // Get all tenants and their rent amounts
    const tenants = await Tenant.find();
    const totalExpectedRent = tenants.reduce((sum, t) => sum + t.rentAmount, 0);
    
    // Get payments for current month
    const currentMonthPayments = await Payment.find({ month: currentMonth });
    const totalPaidThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Calculate paid/unpaid tenants
    const paidTenantIds = new Set();
    const partialTenantIds = new Set();
    
    currentMonthPayments.forEach(payment => {
      const tenant = tenants.find(t => t._id.toString() === payment.tenantId.toString());
      if (tenant) {
        const tenantPayments = currentMonthPayments.filter(p => 
          p.tenantId.toString() === tenant._id.toString()
        );
        const totalPaid = tenantPayments.reduce((sum, p) => sum + p.amount, 0);
        
        if (totalPaid >= tenant.rentAmount) {
          paidTenantIds.add(tenant._id.toString());
        } else {
          partialTenantIds.add(tenant._id.toString());
        }
      }
    });
    
    const paidCount = paidTenantIds.size;
    const unpaidCount = totalTenants - paidCount - partialTenantIds.size;
    const paymentPercentage = totalTenants > 0 ? Math.round((paidCount / totalTenants) * 100) : 0;
    
    const openProblems = await Problem.countDocuments({ resolved: false });
    
    res.json({
      totalTenants,
      activeLeases,
      totalPaidThisMonth,
      totalExpectedRent,
      paidCount,
      unpaidCount,
      partialCount: partialTenantIds.size,
      paymentPercentage,
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
