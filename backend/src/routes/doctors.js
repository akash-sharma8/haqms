const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/doctors
// Retrieve list of doctors with special search filtering
// SECURITY BUG: SQL Injection vulnerability in the search parameter!
// Uses queryRawUnsafe with string concatenation instead of parameterized inputs.
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, specialization } = req.query;

    // let query = 'SELECT * FROM "Doctor"';
    // const conditions = [];

    // if (search) {
    //   // Direct string interpolation - VULNERABLE TO SQL INJECTION!
    //   // Example exploit: search=House%' UNION SELECT id, email, password, name, role, '09:00', '17:00', 0, id FROM "User" --
    //   conditions.push(`name ILIKE '%${search}%'`);  // input directly inject in SQL query
    // }

    // if (specialization && specialization !== 'All') {
    //   conditions.push(`specialization = '${specialization}'`);  // input directly inject in SQL query
    // }

    // if (conditions.length > 0) {
    //   query += ' WHERE ' + conditions.join(' AND ');
    // }

    // console.log(`[SQL-DEBUG] Executing Query: ${query}`);
    // const doctors = await prisma.$queryRawUnsafe(query);   // execut unsafe row SQL


    const doctors = await prisma.doctor.findMany({
      where: {
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
        ...(specialization && specialization !== 'All' && {
          specialization,
        }),
      },
      orderBy: { name: 'asc' },
    });
 
    res.json({ success: true, data: doctors });
  } catch (error) {
    // Leaks query syntax details to candidate/attacker
    res.status(500).json({ success: false, error: 'Database execution failure' });
  }
});

// GET /api/doctors/stats
// Returns aggregation details about available doctors
// PERFORMANCE BUG: Sequential async calls instead of Promise.all()
router.get('/stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();

    // Independent database calls are run sequentially with await, stalling the event loop
    // const totalDoctors = await prisma.doctor.count();

    // const surgeonsCount = await prisma.doctor.count({
    //   where: { department: 'Surgery' },
    // });

    // const averageFee = await prisma.doctor.aggregate({
    //   _avg: {
    //     consultationFee: true,
    //   },
    // });

    // const highestExperience = await prisma.doctor.aggregate({
    //   _max: {
    //     experience: true,
    //   },
    // });

    // each query waits to previous query to finish
    const [totalDoctors, surgeonsCount, averageFee, highestExperience] = await Promise.all([
      prisma.doctor.count(),
      prisma.doctor.count({ where: { department: 'Surgery' } }),
      prisma.doctor.aggregate({ _avg: { consultationFee: true } }),
      prisma.doctor.aggregate({ _max: { experience: true } }),
    ]);
 
    res.json({
      success: true,
      data: {
        total:         totalDoctors,
        surgeons:      surgeonsCount,
        averageFee:    Math.round(averageFee._avg.consultationFee || 0),
        maxExperience: highestExperience._max.experience || 0,
      },
      debugInfo: {
        executionTimeMs: Date.now() - start,
        notes: 'Queries executed in parallel using Promise.all',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doctor stats'});
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
    });

    if (!doctor) {
      return res.status(404).json({ success: false, error: 'Doctor not found' });
    }
 
    res.json({ success: true, data: doctor });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch doctor details' });
  }
});

module.exports = router;
