export function validateDraft(data){
 const errors=[];const a=data.admisiones;
 if(!data.nombre.trim()||data.inicio.titulo.some(line=>!line.trim()))errors.push('Complete el nombre del colegio y las tres líneas del título.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contacto.correo))errors.push('Revise el correo electrónico.');
 if(!/^\d{8,15}$/.test(data.contacto.whatsapp.numero))errors.push('WhatsApp debe contener entre 8 y 15 dígitos, incluido el código de país.');
 if((a.calendarioConfirmado||a.matriculaAbierta||a.aranceles.some(f=>f.monto!==null))&&!a.cursoLectivo)errors.push('Indique el curso lectivo antes de confirmar fechas o registrar aranceles.');
 if(a.matriculaAbierta&&!a.calendarioConfirmado)errors.push('Confirme el calendario antes de anunciar matrícula abierta.');
 if([...a.aranceles,a.reserva].some(f=>f.monto!==null&&(!Number.isFinite(f.monto)||f.monto<0)))errors.push('Los montos deben ser números iguales o mayores que cero.');
 if(data.oferta.some(item=>!item.items.length))errors.push('Cada área debe conservar su lista de asignaturas o idiomas.');
 return errors;
}
