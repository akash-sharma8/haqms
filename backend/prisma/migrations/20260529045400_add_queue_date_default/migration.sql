/*
  Warnings:

  - A unique constraint covering the columns `[doctorId,appointmentDate]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[doctorId,queueDate,tokenNumber]` on the table `QueueToken` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "QueueToken" ADD COLUMN     "queueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_appointmentDate_idx" ON "Appointment"("appointmentDate");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_status_idx" ON "Appointment"("doctorId", "status");

-- CreateIndex
CREATE INDEX "Appointment_createdAt_idx" ON "Appointment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_doctorId_appointmentDate_key" ON "Appointment"("doctorId", "appointmentDate");

-- CreateIndex
CREATE INDEX "Doctor_specialization_idx" ON "Doctor"("specialization");

-- CreateIndex
CREATE INDEX "Doctor_department_idx" ON "Doctor"("department");

-- CreateIndex
CREATE INDEX "Doctor_createdAt_idx" ON "Doctor"("createdAt");

-- CreateIndex
CREATE INDEX "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE INDEX "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE INDEX "Patient_email_idx" ON "Patient"("email");

-- CreateIndex
CREATE INDEX "Patient_createdAt_idx" ON "Patient"("createdAt");

-- CreateIndex
CREATE INDEX "QueueToken_doctorId_idx" ON "QueueToken"("doctorId");

-- CreateIndex
CREATE INDEX "QueueToken_patientId_idx" ON "QueueToken"("patientId");

-- CreateIndex
CREATE INDEX "QueueToken_appointmentId_idx" ON "QueueToken"("appointmentId");

-- CreateIndex
CREATE INDEX "QueueToken_status_idx" ON "QueueToken"("status");

-- CreateIndex
CREATE INDEX "QueueToken_doctorId_createdAt_idx" ON "QueueToken"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "QueueToken_queueDate_idx" ON "QueueToken"("queueDate");

-- CreateIndex
CREATE INDEX "QueueToken_createdAt_idx" ON "QueueToken"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueToken_doctorId_queueDate_tokenNumber_key" ON "QueueToken"("doctorId", "queueDate", "tokenNumber");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");
