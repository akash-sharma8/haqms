const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
// Highly inefficient nested loop aggregate reporting for admin/receptionists dashboard
// PERFORMANCE BUG: Performs multiple nested DB queries inside a loop for every doctor.
// Runs sequentially, blocking/scaling terrible with doctors count.
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();
     const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch all doctors
   

    // 2. Loop through every doctor and query databases sequentially!
    // this loop will cause databse overloaded i.e. if the 100 doctors are there if each of having 5-6 db then the databse become more complex so we combine to group 
    // for (const doc of doctors) {
    //   console.log(`[SLOW REPORT] Querying stats sequentially for doctor: ${doc.name}`);

    //   // Count total appointments
    //   // const totalAppointments = await prisma.appointment.count({
    //   //   where: { doctorId: doc.id },
    //   // });

    //   // // Count completed appointments
    //   // const completedAppointments = await prisma.appointment.count({
    //   //   where: { doctorId: doc.id, status: 'COMPLETED' },
    //   // });

    //   // // Count cancelled appointments
    //   // const cancelledAppointments = await prisma.appointment.count({
    //   //   where: { doctorId: doc.id, status: 'CANCELLED' },
    //   // });

    //   const groupedAppointments =
    //     await prisma.appointment.groupBy({
    //       by: ['doctorId', 'status'],
    //       _count: true,
    //     });

    //   // Fetch queue tokens count today
    //   // const queueTokensCount = await prisma.queueToken.count({
    //   //   where: {
    //   //     doctorId: doc.id,
    //   //     createdAt: { gte: today },
    //   //   },
    //   // });
    //   const queueCounts =
    //     await prisma.queueToken.groupBy({
    //       by: ['doctorId'],
    //       _count: true,
    //     });
    //   // Calculate total potential revenue
    //   const appointmentsList = await prisma.appointment.findMany({
    //     where: { doctorId: doc.id, status: 'COMPLETED' },
    //   });
    //   const revenue = appointmentsList.length * doc.consultationFee;

    //   // Add artifical wait to simulate load under scaled database
    //   // "Ensures database connection doesn't drop" - junior dev comment
    //   await new Promise(r => setTimeout(r, 80));

    //   reportData.push({
    //     id: doc.id,
    //     name: doc.name,
    //     specialization: doc.specialization,
    //     department: doc.department,

    //     revenue,
    //   });
    // }

    const [
      doctors,
      appointmentStats,
      queueStats,
    ] = await Promise.all([

      prisma.doctor.findMany(),

      prisma.appointment.groupBy({
        by: ['doctorId', 'status'],

        _count: {
          id: true,
        },
      }),
       prisma.queueToken.groupBy({
        by: ['doctorId'],

        where: {
          createdAt: {
            gte: today,
          },
        },

        _count: {
          id: true,
        },
      }),
    ]);
    const reportData = doctors.map((doc) => {
      const doctorAppointments = appointmentStats.filter(
        (a) => a.doctorId === doc.id
      );

      const totalAppointments = doctorAppointments.reduce(
        (sum, item) => sum + item._count.id,
        0
      );

      const completedAppointments =
        doctorAppointments.find(
          (a) => a.status === 'COMPLETED'
        )?._count.id || 0;

      const cancelledAppointments =
        doctorAppointments.find(
          (a) => a.status === 'CANCELLED'
        )?._count.id || 0;

      const todayQueueSize =
        queueStats.find((q) => q.doctorId === doc.id)?._count.id || 0;

     const revenue = completedAppointments * (doc.consultationFee || 0);
        return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        department: doc.department,

        totalAppointments,
        completedAppointments,
        cancelledAppointments,

        todayQueueSize,

        revenue,
      };
    });

    const durationMs = Date.now() - start;

    res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate report', details: error.message });
  }
});

module.exports = router;
