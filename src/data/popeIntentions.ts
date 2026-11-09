// Intenciones de oración del Papa (Red Mundial de Oración del Papa).
// 2026: tema de cada mes según la Conferencia del Episcopado Mexicano (episcopado.org), que reproduce la lista oficial.
// 2027: títulos oficiales publicados en enero de 2026 (ACI Prensa / EWTN News).
// El texto completo y el vídeo de cada mes están en popesprayer.va.
export const POPE_PRAYER_URL = 'https://www.popesprayer.va/es/';
export const POPE_INTENTIONS: Record<number, string[]> = {
  2026: [
    'Por la oración con la Palabra de Dios, buscando una Iglesia más fraterna y misionera.',
    'Por los niños que padecen enfermedades incurables y el apoyo a sus familias.',
    'Por el desarme nuclear y el fomento del diálogo diplomático frente a la violencia.',
    'Por los sacerdotes que atraviesan crisis vocacionales.',
    'Por el acceso universal a los alimentos y evitar su desperdicio.',
    'Por el fomento del deporte como instrumento de paz y solidaridad.',
    'Por el respeto y la protección de la vida humana en todas sus etapas.',
    'Por nuevas y creativas formas de evangelización en las grandes ciudades.',
    'Por una gestión justa y sostenible del agua.',
    'Por la integración de un ministerio de salud mental en la Iglesia.',
    'Por el uso ético de la riqueza al servicio del bien común.',
    'Por el apoyo espiritual y eclesial a las familias monoparentales.',
  ],
  2027: [
    'Por el descubrimiento de la fuerza de la oración.',
    'Por el cuidado de quienes cuidan.',
    'Por el respeto de la dignidad de la vida humana.',
    'Por el arte como don que humaniza.',
    'Por las oportunidades laborales para todos.',
    'Por un buen uso de la inteligencia artificial.',
    'Por los abuelos y ancianos.',
    'Por la vocación de los jóvenes.',
    'Por una conversión ecológica integral.',
    'Por las comunidades cristianas.',
    'Por la integración de los migrantes.',
    'Por la vocación cristiana de la familia.',
  ],
};
export const intentionFor = (d: Date) => POPE_INTENTIONS[d.getFullYear()]?.[d.getMonth()] ?? null;
