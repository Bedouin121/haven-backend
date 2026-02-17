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
  eidFrontImage: String, // EID front image URL
  eidBackImage: String, // EID back image URL
  unit: { type: String, required: true },
  building: { type: String, required: true },
  leaseStart: { type: String, required: true },
  leaseEnd: { type: String, required: true },
  totalLeaseAmount: { type: Number, required: true },
  numberOfPayments: { type: String, required: true }, // Changed to String for frequency names
  paymentAmount: { type: Number, required: true },
  paymentSchedule: [{
    paymentNumber: Number,
    dueDate: String,
    windowStart: String,
    windowEnd: String,
    amount: Number
  }],
  rentAmount: { type: Number }, // Legacy field for backward compatibility
  securityDeposit: { type: Number, default: 0 },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const paymentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  month: { type: String }, // Legacy field, kept for backward compatibility
  paymentScheduleId: { type: Number }, // Payment number from payment schedule
  amount: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  method: String,
  proofOfPaymentImage: String, // Proof of payment image URL
  notes: String,
  loggedAt: { type: Date, default: Date.now }, // When this payment was logged
  createdAt: { type: Date, default: Date.now }
});

const problemSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  issueDocumentationImage: String, // Issue documentation image URL
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

const addcBillSchema = new mongoose.Schema({
  villaName: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true }, // Cash, Check, Card
  month: { type: String, required: true }, // YYYY-MM
  year: { type: Number, required: true },
  paymentDate: { type: String, required: true },
  loggedAt: { type: Date, default: Date.now },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

const villaSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Tenant = mongoose.model('Tenant', tenantSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Problem = mongoose.model('Problem', problemSchema);
const ProblemFix = mongoose.model('ProblemFix', problemFixSchema);
const ADDCBill = mongoose.model('ADDCBill', addcBillSchema);
const Villa = mongoose.model('Villa', villaSchema);

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
    // Calculate payment schedule if new format is provided
    if (req.body.totalLeaseAmount && req.body.numberOfPayments && req.body.leaseStart && req.body.leaseEnd) {
      const L = req.body.totalLeaseAmount; // Total lease amount
      const leaseStart = new Date(req.body.leaseStart);
      const leaseEnd = new Date(req.body.leaseEnd);
      
      // Calculate M in fractional months using actual days
      const yearDiff = leaseEnd.getFullYear() - leaseStart.getFullYear();
      const monthDiff = leaseEnd.getMonth() - leaseStart.getMonth();
      const dayDiff = leaseEnd.getDate() - leaseStart.getDate();
      const M = yearDiff * 12 + monthDiff + (dayDiff + 1) / 30.44;
      
      // Map payment frequency string to months
      const frequencyMap = {
        monthly: 1,
        bimonthly: 2,
        quarterly: 3,
        fourmonthly: 4,
        semiannual: 6,
        annual: 12,
        onetime: 0
      };
      
      const F = frequencyMap[req.body.numberOfPayments];
      
      // Validation
      if (L <= 0) {
        return res.status(400).json({ error: 'Total lease amount must be greater than 0' });
      }
      if (M <= 0) {
        return res.status(400).json({ error: 'Lease duration must be greater than 0' });
      }
      
      let paymentSchedule = [];
      let paymentAmount = 0;
      
      if (req.body.numberOfPayments === 'onetime') {
        // One-time payment
        paymentAmount = L;
        paymentSchedule.push({
          paymentNumber: 1,
          dueDate: req.body.leaseStart,
          windowStart: req.body.leaseStart,
          windowEnd: req.body.leaseStart,
          amount: Math.round(L * 100) / 100
        });
      } else {
        // Calculate per-month payable P = L / M
        const P = L / M;
        
        // Determine total periods (ceiling to handle non-divisible cases)
        const totalPeriods = Math.ceil(M / F);
        
        // Helper function to count days between two dates (inclusive)
        const countDays = (start, end) => {
          const msPerDay = 1000 * 60 * 60 * 24;
          return Math.round((end - start) / msPerDay) + 1;
        };
        
        // Calculate the end of the first frequency block (last day of the Fth month from start month)
        const firstBlockEnd = new Date(leaseStart.getFullYear(), leaseStart.getMonth() + F, 0);
        
        // Count days used in first period (from lease start to end of first frequency block)
        const daysUsedInFirstPeriod = countDays(leaseStart, firstBlockEnd);
        
        // Count total days in full first frequency block (from 1st of start month to last day of Fth month)
        const firstBlockStart = new Date(leaseStart.getFullYear(), leaseStart.getMonth(), 1);
        const totalDaysInFirstBlock = countDays(firstBlockStart, firstBlockEnd);
        
        // Calculate first payment (prorated based on days used)
        const firstPaymentRaw = (daysUsedInFirstPeriod / totalDaysInFirstBlock) * (P * F);
        const firstPayment = Math.round(firstPaymentRaw * 100) / 100;
        
        // Remaining balance after first payment
        const remainingBalance = L - firstPayment;
        
        // Remaining periods
        const remainingPeriods = totalPeriods - 1;
        
        // Regular payment amount (evenly divided, rounded)
        const regularPaymentRaw = remainingBalance / remainingPeriods;
        const regularPayment = Math.round(regularPaymentRaw * 100) / 100;
        
        // Calculate final payment to ensure exact total
        const sumOfRegularPayments = regularPayment * (remainingPeriods - 1);
        const finalPayment = Math.round((L - firstPayment - sumOfRegularPayments) * 100) / 100;
        
        // Build payment schedule
        for (let i = 0; i < totalPeriods; i++) {
          let dueDate;
          let amount;
          
          if (i === 0) {
            // First payment due on lease start date
            dueDate = new Date(leaseStart);
            amount = firstPayment;
          } else {
            // Subsequent payments due on 5th of first month of each period
            dueDate = new Date(leaseStart);
            dueDate.setMonth(dueDate.getMonth() + (i * F));
            dueDate.setDate(5);
            
            // Last payment gets the final calculated amount
            amount = (i === totalPeriods - 1) ? finalPayment : regularPayment;
          }
          
          paymentSchedule.push({
            paymentNumber: i + 1,
            dueDate: dueDate.toISOString().split('T')[0],
            windowStart: dueDate.toISOString().split('T')[0],
            windowEnd: dueDate.toISOString().split('T')[0],
            amount: amount
          });
        }
        
        // Set average payment amount for display
        paymentAmount = Math.round((L / totalPeriods) * 100) / 100;
      }
      
      req.body.paymentAmount = paymentAmount;
      req.body.paymentSchedule = paymentSchedule;
      req.body.rentAmount = paymentAmount; // For backward compatibility
    }
    
    const tenant = new Tenant(req.body);
    await tenant.save();
    res.status(201).json(tenant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/tenants', async (req, res) => {
  try {
    const { tenantIds } = req.body;
    
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'tenantIds array is required' });
    }
    
    // Delete tenants
    await Tenant.deleteMany({ _id: { $in: tenantIds } });
    
    // Delete associated payments
    await Payment.deleteMany({ tenantId: { $in: tenantIds } });
    
    // Delete associated problems/maintenance issues
    await Problem.deleteMany({ tenantId: { $in: tenantIds } });
    
    // Delete associated problem fixes
    await ProblemFix.deleteMany({ tenantId: { $in: tenantIds } });
    
    res.json({ message: `Successfully deleted ${tenantIds.length} tenant(s) and associated data` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payments
app.get('/api/payments', async (req, res) => {
  try {
    const { tenantId } = req.query;
    let query = {};
    
    if (tenantId) {
      query = { tenantId };
    }
    
    const payments = await Payment.find(query).populate('tenantId').sort({ loggedAt: -1, createdAt: -1 });
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

// ADDC Bills
app.get('/api/addc-bills', async (req, res) => {
  try {
    const { villaName, month, year } = req.query;
    let query = {};
    
    if (villaName) query.villaName = villaName;
    if (month) query.month = month;
    if (year) query.year = parseInt(year);
    
    const bills = await ADDCBill.find(query).sort({ loggedAt: -1, createdAt: -1 });
    res.json(bills);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/addc-bills', async (req, res) => {
  try {
    const bill = new ADDCBill(req.body);
    await bill.save();
    res.status(201).json(bill);
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
