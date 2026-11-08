// Examen de conciencia. Textos propios de la app, pensados para jóvenes y adultos,
// a partir de los Diez Mandamientos y los mandamientos de la Iglesia (Catecismo, 2052-2557 y 2041-2043).
// Conviene que los revise un sacerdote antes del lanzamiento.

export interface ExamenSection { id: string; title: string; summary: string; questions: string[] }

export const EXAMEN_INTRO = [
  'Busca un momento tranquilo. No se trata de hacer una lista para sentirte mal, sino de mirar tu vida con los ojos de Dios, que te quiere y te espera.',
  'Pide luz al Espíritu Santo antes de empezar. Lee cada pregunta con calma y quédate con lo que de verdad te toque.',
];

export const EXAMEN_PRAYER = 'Ven, Espíritu Santo, ilumina mi corazón para que vea mis pecados con verdad y sin miedo, me arrepienta de ellos y confíe en la misericordia del Padre. Amén.';

export const EXAMEN: ExamenSection[] = [
  { id: 'm1', title: 'Amarás a Dios sobre todas las cosas', summary: 'Primer mandamiento', questions: [
    '¿He dejado de rezar durante mucho tiempo, o rezo solo cuando necesito algo?',
    '¿He puesto por delante de Dios el dinero, el éxito, la imagen, una relación o el móvil?',
    '¿He dudado de la fe a propósito o me he avergonzado de ella delante de otros?',
    '¿He recurrido a horóscopos, tarot, videntes u otras prácticas supersticiosas?',
  ] },
  { id: 'm2', title: 'No tomarás el nombre de Dios en vano', summary: 'Segundo mandamiento', questions: [
    '¿He usado el nombre de Dios, de la Virgen o de los santos con falta de respeto o en broma?',
    '¿He jurado en falso o he prometido algo a Dios sin intención de cumplirlo?',
    '¿Me he burlado de la fe, de la Iglesia o de lo sagrado?',
  ] },
  { id: 'm3', title: 'Santificarás las fiestas', summary: 'Tercer mandamiento', questions: [
    '¿He faltado a misa un domingo o un día de precepto sin un motivo serio?',
    '¿He llegado tarde o he estado en misa sin atención, pendiente de otras cosas?',
    '¿He dedicado el domingo a Dios, a la familia y al descanso, o lo he llenado de trabajo innecesario?',
  ] },
  { id: 'm4', title: 'Honrarás a tu padre y a tu madre', summary: 'Cuarto mandamiento', questions: [
    '¿He tratado mal, con desprecio o con malas contestaciones a mis padres o a mi familia?',
    '¿Les he mentido o desobedecido en cosas importantes?',
    '¿Me preocupo por ellos y les ayudo, sobre todo si están mayores o enfermos?',
    '¿He respetado a profesores, jefes y personas con autoridad?',
  ] },
  { id: 'm5', title: 'No matarás', summary: 'Quinto mandamiento', questions: [
    '¿He guardado rencor, he deseado el mal a alguien o me he negado a perdonar?',
    '¿He insultado, humillado o hecho daño a alguien, también en redes sociales o en grupos?',
    '¿He puesto en peligro mi salud o la de otros con el alcohol, las drogas o conduciendo de forma imprudente?',
    '¿He participado, aconsejado o colaborado en un aborto?',
    '¿He sido indiferente ante quien sufre o necesita ayuda?',
  ] },
  { id: 'm6', title: 'No cometerás actos impuros', summary: 'Sexto y noveno mandamientos', questions: [
    '¿He tratado mi cuerpo y el de los demás con respeto, como un don de Dios?',
    '¿He consumido pornografía o contenidos que me alejan de una mirada limpia?',
    '¿He tenido pensamientos, conversaciones o actos contrarios a la castidad propia de mi estado de vida?',
    '¿He utilizado a otra persona o he presionado a alguien?',
    '¿He sido fiel en mi noviazgo o en mi matrimonio?',
  ] },
  { id: 'm7', title: 'No robarás', summary: 'Séptimo y décimo mandamientos', questions: [
    '¿He cogido algo que no era mío, o me he quedado con algo prestado o encontrado?',
    '¿He copiado en exámenes, he hecho trampas o he descargado lo que debía pagar?',
    '¿He malgastado el dinero o he sido avaricioso, sin compartir con quien lo necesita?',
    '¿He envidiado lo que tienen otros hasta entristecerme por su bien?',
    '¿He cumplido con honradez en mis estudios o en mi trabajo?',
  ] },
  { id: 'm8', title: 'No dirás falso testimonio ni mentirás', summary: 'Octavo mandamiento', questions: [
    '¿He mentido, aunque sea para quedar bien o para evitar problemas?',
    '¿He criticado, difundido rumores o contado defectos de otros sin necesidad?',
    '¿He compartido capturas, fotos o mensajes privados de otros sin su permiso?',
    '¿He juzgado a alguien sin conocer su situación?',
  ] },
  { id: 'iglesia', title: 'Los mandamientos de la Iglesia', summary: 'Vida en la Iglesia', questions: [
    '¿Me he confesado al menos una vez al año?',
    '¿He comulgado por Pascua de Resurrección? ¿He comulgado estando en pecado grave?',
    '¿He guardado el ayuno y la abstinencia en los días que manda la Iglesia?',
    '¿Ayudo a la Iglesia según mis posibilidades?',
  ] },
];

export const CONFESSION_STEPS = [
  { title: 'Examina tu conciencia', text: 'Es lo que acabas de hacer. Si quieres, apunta en un papel lo más importante para no olvidarlo.' },
  { title: 'Arrepiéntete', text: 'Dolor de corazón por haber ofendido a Dios, que te quiere. Basta con que sea sincero.' },
  { title: 'Propón no volver a pecar', text: 'Decide cambiar con la ayuda de Dios, aunque sepas que te costará.' },
  { title: 'Di tus pecados al sacerdote', text: 'Empieza con «Ave María Purísima», y él responde «Sin pecado concebida». Di cuánto hace de tu última confesión y cuenta tus pecados con sencillez. Si no sabes cómo decir algo, el sacerdote te ayudará.' },
  { title: 'Cumple la penitencia', text: 'Escucha el consejo, reza el acto de contrición cuando te lo pida, recibe la absolución y cumple la penitencia que te ponga.' },
];
