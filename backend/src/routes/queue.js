const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/queue
// List all active queue tokens
router.get('/', authenticate, async (req, res) => {
  try {
    const { doctorId, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;
    const where = {
      ...(doctorId && { doctorId }),

      ...(status && {
        status,
      }),
    };

    const [tokens, totalTokens] = await Promise.all([
      prisma.queueToken.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: 'asc',
        },

        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },

          doctor: {
            select: {
              id: true,
              name: true,
              specialization: true,
            },
          },
        },
      }),

      prisma.queueToken.count({ where }),
    ]);

    res.json({
      success: true,
      data: tokens,

      pagination: {
        page,
        limit,
        totalTokens,
        totalPages: Math.ceil(totalTokens / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve queue' });
  }
});

// POST /api/queue/checkin
// Generate a new queue token for a patient
// CONCURRENCY/RACE CONDITION BUG: Token increment uses aggregate read followed by create.
// Introduce a deliberate asynchronous delay (setTimeout) to force a wide race window
// where concurrent check-ins assign the exact same token number.
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({ error: 'Patient and Doctor ID are required for check-in.' });
    }

    // 1. Fetch current maximum token number for this doctor today
    // const maxTokenResult = await prisma.queueToken.aggregate({
    //   where: {
    //     doctorId,
    //     createdAt: { gte: today },
    //   },
    //   _max: {
    //     tokenNumber: true,
    //   },
    // });

    // const currentMax = maxTokenResult._max.tokenNumber || 0;
    // const nextTokenNumber = currentMax + 1;      // duplicate tokens // inconsistent queue order // possible crashes if unique constraint exists // these problem occure when we consider about two lines of code 



    // // PERFORMANCE/CONCURRENCY BUG: Artificial sleep to widen the race condition window.
    // // In production under microservices or high load, network delay does this naturally.
    // // Junior developer comment: "Adding sleep to make sure db registers the record correctly before moving forward"
    // await new Promise((resolve) => setTimeout(resolve, 350));  //This does NOT help the DB “register records correctly”

    // // 2. Insert new token
    // const newToken = await prisma.queueToken.create({
    //   data: {
    //     tokenNumber: nextTokenNumber,
    //     patientId,
    //     doctorId,
    //     appointmentId: appointmentId || null,
    //     status: 'WAITING',
    //   },
    //   include: {
    //     patient: true,
    //     doctor: true,
    //   },
    // });

    // res.status(201).json({
    //   message: 'Checked in successfully. Token generated.',
    //   token: newToken,
    // });

    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
      }),

      prisma.doctor.findUnique({
        where: { id: doctorId },
      }),
    ]);

    if (!patient) {
      return res.status(404).json({
        error: 'Patient not found',
      });
    }

    if (!doctor) {
      return res.status(404).json({
        error: 'Doctor not found',
      });
    }


    const token = await prisma.$transaction(
      async (tx) => {

        const maxToken = await tx.queueToken.aggregate({
          where: {
            doctorId,
            createdAt: { gte: today },
          },
          _max: {
            tokenNumber: true,
          },
        });

        const nextToken =
          (maxToken._max.tokenNumber || 0) + 1;

        return await tx.queueToken.create({
          data: {
            tokenNumber: nextToken,
            patientId,
            doctorId,
            appointmentId: appointmentId || null,
            status: 'WAITING',
          },
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                phoneNumber: true,
              },
            },

            doctor: {
              select: {
                id: true,
                name: true,
                specialization: true,
              },
            },
          },
        });
      }, {
      isolationLevel: 'Serializable',
    });
    res.status(201).json({
      success: true,
      message: 'Checked in successfully',
      data: token,
    });


  } catch (error) {
    console.error('Queue check-in error:', error);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// PATCH /api/queue/:id
// Update token status (WAITING -> CALLING -> COMPLETED / SKIPPED)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const allowedStatuses = [
      'WAITING',
      'CALLING',
      'COMPLETED',
      'SKIPPED',
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
      });
    }

    const updatedToken = await prisma.queueToken.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },

        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Queue token updated successfully',
      data: updatedToken,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update queue token' });
  }
});

module.exports = router;
