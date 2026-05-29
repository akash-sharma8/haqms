const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorizeAdminOnlyLegacy } = require('../middleware/auth');

const router = express.Router();


// GET /api/patients
// Get all patients with search, filtering, and INEFICIENT IN-MEMORY PAGINATION
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, gender } = req.query;

    // Inefficient: Retrieve all matching rows without take/skip limits from the database.
    // Scales poorly as patient directory grows.
    // const allPatients = await prisma.patient.findMany({
    //   orderBy: { createdAt: 'desc' },
    // });

    // let filteredPatients = allPatients;

    // // In-memory filter for search (checks name/phone/email)
    // if (search) {
    //   const query = search.toLowerCase();
    //   filteredPatients = filteredPatients.filter(
    //     (p) =>
    //       p.name.toLowerCase().includes(query) ||
    //       p.phoneNumber.includes(query) ||
    //       (p.email && p.email.toLowerCase().includes(query))
    //   );
    // }

    // // In-memory filter for gender
    // if (gender && gender !== 'All') {
    //   filteredPatients = filteredPatients.filter(
    //     (p) => p.gender.toLowerCase() === gender.toLowerCase()
    //   );
    // }

    // In-memory pagination setup
   const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 5), 100);
    const skip  = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { name:        { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
          { email:       { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(gender && gender !== 'All' && {
        gender: { equals: gender, mode: 'insensitive' },
      }),
    };

   const [patients, totalPatients] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,           // FIX: was `offset` — Prisma uses `skip`
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.patient.count({ where }),
    ]);
 
    res.json({
      success: true,
      patients,         // FIX: was `paginatedResult` (undefined variable)
      pagination: {
        page,
        limit,
        totalPatients,  // FIX: was `filteredPatients.length` (undefined variable)
        totalPages: Math.ceil(totalPatients / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/:id
// Get patient details by ID. Notice N+1 issue could be placed here or in appointments,
// but let's make it fetch the patient with their appointments and tokens.
router.get('/:id', authenticate, async (req, res) => {
  try {
     const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          include: { doctor: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
 
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }
 
    res.json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// POST /api/patients (Register patient)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, email, phoneNumber, age, gender, medicalHistory } = req.body;
if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    // INCONSISTENT VALIDATION:
    // Email is nullable in schema, but here we only check missing fields.
    // No regex to check telephone number formats, allowing random strings like "abc" to be stored!
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({ success: false, error: 'Phone number must be exactly 10 digits' });
    }

  // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
 
    // Validate age
    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      return res.status(400).json({ success: false, error: 'Age must be a number between 0 and 120' });
    }

    const allowedGenders = ['Male', 'Female', 'Other'];

    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({ success: false, error: 'Invalid gender' });
    }

    const patient = await prisma.patient.create({
      data: {
        name: name.trim(),
        email: email || null,
        phoneNumber,
        age: parsedAge,
        gender,
        medicalHistory: medicalHistory?.trim() || null,
      },
    });
 
    res.status(201).json({ success: true, patient });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to register patient' });
  }
});

// DELETE /api/patients/:id
// SECURITY BUG: The route relies on authorizeAdminOnlyLegacy, which has the bypassed admin validation check!
// This allows any receptionist or doctor to delete a patient.
router.delete('/:id', authenticate, authorizeAdminOnlyLegacy, async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    await prisma.patient.delete({ where: { id } });

    res.json({ success: true, message: `Successfully deleted patient ${patient.name}` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete patient' });
  }
});

module.exports = router;
