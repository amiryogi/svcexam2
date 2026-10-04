import express, { Router } from 'express';
import { idParams, studentListQuery, studentSchema } from '@svi/shared';
import { ctxOf } from '../../lib/audit.js';
import { parse } from '../../lib/errors.js';
import * as svc from './students.service.js';

export const studentsRouter = Router();

studentsRouter.get('/', async (req, res) => {
  res.json(await svc.listStudents(parse(studentListQuery, req.query)));
});

studentsRouter.post(
  '/import',
  express.text({ type: ['text/csv', 'text/plain'], limit: '2mb' }),
  async (req, res) => {
    const dryRun = req.query.dryRun !== 'false';
    const csv = typeof req.body === 'string' ? req.body : '';
    res.json(await svc.importStudents(csv, dryRun, ctxOf(req)));
  },
);

studentsRouter.get('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await svc.getStudent(id));
});

studentsRouter.post('/', async (req, res) => {
  res.status(201).json(await svc.createStudent(parse(studentSchema, req.body), ctxOf(req)));
});

studentsRouter.put('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  res.json(await svc.updateStudent(id, parse(studentSchema, req.body), ctxOf(req)));
});

studentsRouter.delete('/:id', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await svc.setDeleted(id, true, ctxOf(req));
  res.status(204).end();
});

studentsRouter.post('/:id/restore', async (req, res) => {
  const { id } = parse(idParams, req.params);
  await svc.setDeleted(id, false, ctxOf(req));
  res.status(204).end();
});
