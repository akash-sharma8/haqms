const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/appointments
// List all appointments
// PERFORMANCE BUG: Classic N+1 Query Issue!
// Instead of using Prisma's include, it loops through each appointment and executes
// individual select statements for Patient and Doctor details.
router.get('/', authenticate, async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    // const where = {};
    // if (doctorId) where.doctorId = doctorId;
    // if (status) where.status = status;

    // Fetch core appointments
    // const appointments = await prisma.appointment.findMany({
    //   where,
    //   orderBy: { appointmentDate: 'asc' },
    // });

    // const detailedAppointments = [];

    // N+1 triggers here: For every single appointment, we perform two extra queries!
    // for (const app of appointments) {
    //   console.log(`[N+1 DB QUERY] Fetching Patient (${app.patientId}) and Doctor (${app.doctorId}) for Appointment ${app.id}`);

    //   const patient = await prisma.patient.findUnique({
    //     where: { id: app.patientId },
    //   });

    //   const doctor = await prisma.doctor.findUnique({
    //     where: { id: app.doctorId },
    //   });

    //   detailedAppointments.push({
    //     ...app,
    //     patient: patient ? { id: patient.id, name: patient.name, phoneNumber: patient.phoneNumber, age: patient.age, medicalHistory: patient.medicalHistory } : null,
    //     doctor: doctor ? { id: doctor.id, name: doctor.name, specialization: doctor.specialization } : null,
    //   });
    // }
    // const appointments = await prisma.appointment.findMany({
    //   where,
    //   orderBy: { appointmentDate: 'asc' },

    //   include: {
    //     patient: {
    //       select: {
    //         id: true,
    //         name: true,
    //         phoneNumber: true,
    //         age: true,
    //         medicalHistory: true,
    //       },
    //     },

    //     doctor: {
    //       select: {
    //         id: true,
    //         name: true,
    //         specialization: true,
    //       },
    //     },
    //   },
    // });
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(doctorId && { doctorId }),

      ...(status && {
        status,
      }),
    };

    const [appointments, totalAppointments] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          appointmentDate: 'asc',
        },

        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              age: true,
              medicalHistory: true,
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

      prisma.appointment.count({ where }),
    ]);


    res.json({
      success: true,
      data: appointments,
      pagination: {
        page,
        limit,
        totalAppointments,
        totalPages: Math.ceil(totalAppointments / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// POST /api/appointments
// Book an appointment
// DESIGN BUG: Duplicate-prone schema. No unique index blocks duplicate appointment bookings.
// In this API, we have a half-hearted verification that is easily bypassed or logically flawed,
// allowing multiple bookings for the exact same date and doctor.
router.post('/', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentDate, reason } = req.body;

    if (!patientId || !doctorId || !appointmentDate) {
      return res.status(400).json({ error: 'Patient, Doctor, and Appointment Date are required.' });
    }

    const appDate = new Date(appointmentDate);
    if (isNaN(appDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid appointment date',
      });
    }
    if (appDate < new Date()) {
      return res.status(400).json({
        error: 'Appointment date must be in the future',
      });
    }
    // Validate patient + doctor existence
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
    // Flawed duplicate check:
    // It only checks if the exact millisecond matches. If the candidate books for "2026-05-25 10:00:00"
    // and another for "2026-05-25 10:00:01", they are treated as unique!
    // Junior dev logic: "Same time bookings will be blocked."
    const start = new Date(appDate);
    const end = new Date(appDate);

    end.setMinutes(end.getMinutes() + 30);
    const existingBooking = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: {
          gte: start,
          lte: end,
        },
        status: { not: 'CANCELLED' },
      },
    });

    if (existingBooking) {
      return res.status(400).json({
        error: 'Double booking blocked. Doctor already has an appointment at this exact millisecond.',
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: appDate,
        reason: reason || '',
        status: 'PENDING',
      },
       include: {
        patient: {
          select: {
            id: true,
            name: true,
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
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: appointment,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// PATCH /api/appointments/:id
// Update appointment status (COMPLETED, CANCELLED, etc.)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = [
      'PENDING',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED',
    ];

    if (!status) {
      return res.status(400).json({
        error: 'Status is required',
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
      });
    }

    const appointment = await prisma.appointment.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!appointment) {
      return res.status(404).json({
        error: 'Appointment not found',
      });
    }

    const updated = await prisma.appointment.update({
      where: {
        id: req.params.id 
       },
      data: {
        status 
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },

        doctor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

module.exports = router;
