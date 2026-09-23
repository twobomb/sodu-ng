/* eslint-disable no-undef */
// ============================================================
// ДТП + привлекаемый личный состав
// Новые колонки calls:
//   - dtp_circumstances    (text)   — обстоятельства ДТП
//   - dtp_vehicle_marks    (jsonb)  — марки автомобилей участников ДТП
//   - dtp_work_description (text)   — описание выполненных работ на месте
//   - involved_staff       (jsonb)  — привлекаемый л/с: [{department_id, count}]
// ============================================================

exports.up = (pgm) => {
    pgm.addColumns('calls', {
        dtp_circumstances: { type: 'text' },
        dtp_vehicle_marks: { type: 'jsonb' },
        dtp_work_description: { type: 'text' },
        involved_staff: { type: 'jsonb' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('calls', [
        'dtp_circumstances',
        'dtp_vehicle_marks',
        'dtp_work_description',
        'involved_staff',
    ]);
};