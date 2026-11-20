import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { INITIAL_BRANCH_STORES } from './src/data/initialData';

dotenv.config();

const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(os.tmpdir(), 'saheb-elsaada-data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

interface StoredCustomer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  passwordHash: string;
  favoriteMenuIds: string[];
  createdAt: string;
}

interface StoredAdmin {
  username: string;
  passwordHash: string;
  role: 'admin';
}

interface UsersDb {
  admin: StoredAdmin;
  customers: StoredCustomer[];
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`saheb_elsaada_salt_${password}`).digest('hex');
}

function createToken(payload: object): string {
  return Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
}

function ensureStoreFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(INITIAL_BRANCH_STORES, null, 2), 'utf-8');
  }
}

function ensureUsersDb(): UsersDb {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    const initialUsers: UsersDb = {
      admin: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
      },
      customers: [
        {
          id: 'cust-demo-1',
          name: 'سارة محمد',
          email: 'sara@example.com',
          phone: '01099887766',
          address: 'التجمع الخامس، الحي الأول، شارع ١٢',
          passwordHash: hashPassword('123456'),
          favoriteMenuIds: ['m-1', 'm-3', 'm-5'],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
    return initialUsers;
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as UsersDb;
    if (!parsed.admin || parsed.admin.username !== 'admin') {
      parsed.admin = {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
      };
      fs.writeFileSync(USERS_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch {
    return {
      admin: {
        username: 'admin',
        passwordHash: hashPassword('admin123'),
        role: 'admin',
      },
      customers: [],
    };
  }
}

function saveUsersDb(db: UsersDb) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function isLegacySampleMenu(menu: unknown): boolean {
  if (!Array.isArray(menu) || menu.length === 0) return true;
  return menu.some(
    (m) =>
      m &&
      typeof m === 'object' &&
      'id' in m &&
      (m.id === 'm-1' ||
        m.id === 'moez-m-1' ||
        (String(m.id).endsWith('-juc-1') &&
          'imageUrl' in m &&
          m.imageUrl === '/assets/aistudio/unnamed_062b5ea3.jpg'))
  );
}

function isLegacyPartyShows(shows: unknown): boolean {
  if (!Array.isArray(shows) || shows.length === 0) return false;
  return shows.some(
    (s) => s && typeof s === 'object' && 'id' in s && ['s-sat', 'moez-s-sat', 'zayed-s-sat'].includes(String(s.id))
  );
}

function readStore() {
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.branch_tagamoa && parsed.branch_moez) {
      let dirty = false;
      if (isLegacySampleMenu(parsed.branch_tagamoa.menu)) {
        parsed.branch_tagamoa.menu = INITIAL_BRANCH_STORES.branch_tagamoa.menu;
        dirty = true;
      }
      if (isLegacySampleMenu(parsed.branch_moez.menu)) {
        parsed.branch_moez.menu = INITIAL_BRANCH_STORES.branch_moez.menu;
        dirty = true;
      }
      if (!parsed.branch_zayed) {
        parsed.branch_zayed = INITIAL_BRANCH_STORES.branch_zayed;
        dirty = true;
      } else if (isLegacySampleMenu(parsed.branch_zayed.menu)) {
        parsed.branch_zayed.menu = INITIAL_BRANCH_STORES.branch_zayed.menu;
        dirty = true;
      }
      for (const bKey of ['branch_tagamoa', 'branch_moez', 'branch_zayed'] as const) {
        if (Array.isArray(parsed[bKey]?.menu)) {
          const filtered = parsed[bKey].menu.filter(
            (m: { category?: string; id?: string }) =>
              m.category !== 'shisha' &&
              !['tag-shs-1', 'tag-shs-2', 'moez-shs-1', 'moez-shs-2'].includes(String(m.id || ''))
          );
          if (filtered.length !== parsed[bKey].menu.length) {
            parsed[bKey].menu = filtered;
            dirty = true;
          }
        }
        if (
          Array.isArray(parsed[bKey]?.gallery) &&
          parsed[bKey].gallery.some(
            (g: { id?: string; titleAr?: string; titleEn?: string }) =>
              ['g-2', 'g-4', 'moez-g-2', 'moez-g-3', 'zayed-g-1', 'zayed-g-3'].includes(String(g.id || '')) &&
              /تنورة|شيشة|عود|مسرح|tanoura|shisha|oud/i.test(`${g.titleAr || ''} ${g.titleEn || ''}`)
          )
        ) {
          parsed[bKey].gallery = INITIAL_BRANCH_STORES[bKey].gallery;
          dirty = true;
        }
        if (isLegacyPartyShows(parsed[bKey]?.shows)) {
          parsed[bKey].shows = INITIAL_BRANCH_STORES[bKey].shows;
          dirty = true;
        }
        if (!parsed[bKey].cmsSettings) {
          parsed[bKey].cmsSettings = INITIAL_BRANCH_STORES[bKey].cmsSettings;
          dirty = true;
        } else {
          const fallbackCms = INITIAL_BRANCH_STORES[bKey].cmsSettings;
          for (const key of ['instagramUrl', 'facebookUrl', 'tiktokUrl'] as const) {
            if (parsed[bKey].cmsSettings[key] === undefined && fallbackCms?.[key] !== undefined) {
              parsed[bKey].cmsSettings[key] = fallbackCms[key];
              dirty = true;
            }
          }
        }
      }
      if (dirty) {
        fs.writeFileSync(STORE_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
      }
      return parsed;
    }
    const migrated = {
      branch_tagamoa:
        parsed && Array.isArray(parsed.menu) && !isLegacySampleMenu(parsed.menu)
          ? parsed
          : INITIAL_BRANCH_STORES.branch_tagamoa,
      branch_moez: INITIAL_BRANCH_STORES.branch_moez,
      branch_zayed: INITIAL_BRANCH_STORES.branch_zayed,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(migrated, null, 2), 'utf-8');
    return migrated;
  } catch {
    return INITIAL_BRANCH_STORES;
  }
}

function writeStore(data: unknown) {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  ensureStoreFile();
  ensureUploadsDir();
  ensureUsersDb();
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Serve extensionless Moez PDF menu with proper PDF headers so browsers view it inline
  app.get('/assets/aistudio/Moez_Menu_e7fb261f', (_req, res, next) => {
    const pdfPath = path.join(process.cwd(), 'public', 'assets', 'aistudio', 'Moez_Menu_e7fb261f');
    if (!fs.existsSync(pdfPath)) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Moez_Menu.pdf"');
    res.sendFile(pdfPath);
  });

  // --- Customer Authentication Routes ---
  app.post('/api/auth/customer/signup', (req, res) => {
    const { name, email, phone, address, password } = req.body || {};
    if (!name || !phone || !password) {
      res.status(400).json({ error: 'يرجى إدخال الاسم ورقم الهاتف وكلمة المرور' });
      return;
    }

    const db = ensureUsersDb();
    const normalizedPhone = String(phone).trim();
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

    const exists = db.customers.find(
      (c) => c.phone === normalizedPhone || (normalizedEmail && c.email?.toLowerCase() === normalizedEmail)
    );
    if (exists) {
      res.status(409).json({ error: 'رقم الهاتف مسجل بالفعل، يرجى تسجيل الدخول' });
      return;
    }

    const newCustomer: StoredCustomer = {
      id: `cust-${Date.now()}`,
      name: String(name).trim(),
      email: normalizedEmail || undefined,
      phone: normalizedPhone,
      address: String(address || 'التجمع الخامس، القاهرة الجديدة').trim(),
      passwordHash: hashPassword(String(password)),
      favoriteMenuIds: [],
      createdAt: new Date().toISOString(),
    };

    db.customers.push(newCustomer);
    saveUsersDb(db);

    const token = createToken({ id: newCustomer.id, role: 'customer' });
    res.json({
      user: {
        id: newCustomer.id,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        favoriteMenuIds: newCustomer.favoriteMenuIds,
        createdAt: newCustomer.createdAt,
      },
      token,
    });
  });

  app.post('/api/auth/customer/login', (req, res) => {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      res.status(400).json({ error: 'يرجى إدخال رقم الهاتف وكلمة المرور' });
      return;
    }

    const db = ensureUsersDb();
    const cleanId = String(identifier).trim().toLowerCase();
    const passHash = hashPassword(String(password));

    const customer = db.customers.find(
      (c) => (c.phone === cleanId || (c.email && c.email.toLowerCase() === cleanId)) && c.passwordHash === passHash
    );

    if (!customer) {
      res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
      return;
    }

    const token = createToken({ id: customer.id, role: 'customer' });
    res.json({
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        favoriteMenuIds: customer.favoriteMenuIds || [],
        createdAt: customer.createdAt,
      },
      token,
    });
  });

  app.put('/api/auth/customer/profile', (req, res) => {
    const { id, name, phone, address, favoriteMenuIds } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'Missing customer ID' });
      return;
    }
    const db = ensureUsersDb();
    const idx = db.customers.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    db.customers[idx] = {
      ...db.customers[idx],
      name: name ? String(name).trim() : db.customers[idx].name,
      phone: phone ? String(phone).trim() : db.customers[idx].phone,
      address: address !== undefined ? String(address).trim() : db.customers[idx].address,
      favoriteMenuIds: Array.isArray(favoriteMenuIds)
        ? favoriteMenuIds
        : db.customers[idx].favoriteMenuIds || [],
    };
    saveUsersDb(db);

    const updated = db.customers[idx];
    res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        favoriteMenuIds: updated.favoriteMenuIds || [],
        createdAt: updated.createdAt,
      },
    });
  });

  // --- Protected Admin Authentication Route ---
  app.post('/api/auth/admin/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
      return;
    }

    const db = ensureUsersDb();
    const cleanUser = String(username).trim().toLowerCase();
    const passHash = hashPassword(String(password));

    const isDefaultAdmin = cleanUser === 'admin' && String(password) === 'admin123';
    const isStoredAdmin =
      cleanUser === db.admin.username.toLowerCase() && passHash === db.admin.passwordHash;

    if (!isDefaultAdmin && !isStoredAdmin) {
      res.status(401).json({ error: 'بيانات دخول الإدارة غير صحيحة' });
      return;
    }

    const token = createToken({ adminUsername: db.admin.username, role: 'admin' });
    res.json({
      session: {
        token,
        role: 'admin',
        adminUsername: db.admin.username,
      },
    });
  });

  // --- Restaurant Store CRUD Routes ---
  app.get('/api/store', (_req, res) => {
    res.json(readStore());
  });

  app.put('/api/store', (req, res) => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Invalid store payload' });
      return;
    }
    writeStore(req.body);
    res.json({ ok: true, store: req.body });
  });

  app.post('/api/upload-image', (req, res) => {
    try {
      const { dataUrl, filename } = req.body || {};
      if (typeof dataUrl !== 'string') {
        res.status(400).json({ error: 'Missing image data' });
        return;
      }
      const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
      if (!match) {
        res.status(400).json({ error: 'Invalid image format' });
        return;
      }
      const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
      const base64Body = match[2];
      const buffer = Buffer.from(base64Body, 'base64');
      ensureUploadsDir();
      const safeStem = String(filename || 'dish')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .slice(0, 32) || 'dish';
      const outName = `${safeStem}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, outName), buffer);
      res.json({ url: `/uploads/${outName}` });
    } catch {
      res.status(500).json({ error: 'Failed to save uploaded image' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Saheb El Saada server running on http://localhost:${PORT}`);
  });
}

startServer();
