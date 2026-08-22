import { describe, it, expect } from 'vitest';
import { app, usersDb } from '../../backend/src/app';
import { hospitalMatchingService } from '../../backend/src/services/hospital_matching';
import http from 'http';

function makeRequest(path: string, method: string = 'POST', body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address() as any;
      const port = address.port;

      const payload = body ? JSON.stringify(body) : '';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: port,
          path: path,
          method: method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            server.close();
            try {
              const parsed = JSON.parse(data);
              resolve({ status: res.statusCode || 500, body: parsed });
            } catch (e) {
              resolve({ status: res.statusCode || 500, body: data });
            }
          });
        }
      );

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe('Authentication & Registration Integration Tests', () => {
  it('should authenticate default patient user via /v1/auth/login', async () => {
    const res = await makeRequest('/v1/auth/login', 'POST', {
      emailOrPhone: 'jane.doe@example.com',
      password: 'password123',
      role: 'patient'
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.role).toBe('patient');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('jane.doe@example.com');
  });

  it('should register a new patient user via /v1/users and allow login', async () => {
    const signupRes = await makeRequest('/v1/users', 'POST', {
      fullName: 'Alice Smith',
      email: 'alice.smith@example.com',
      phoneNumber: '+1-555-0999',
      password: 'mypassword',
      bloodType: 'A+',
      budgetCeiling: 50000
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user).toBeDefined();
    expect(signupRes.body.user.fullName).toBe('Alice Smith');

    const loginRes = await makeRequest('/v1/auth/login', 'POST', {
      emailOrPhone: 'alice.smith@example.com',
      password: 'mypassword',
      role: 'patient'
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('patient');
    expect(loginRes.body.user.fullName).toBe('Alice Smith');
  });

  it('should register a new hospital with flat payload via /v1/hospitals and allow login by email', async () => {
    const hospitalId = `hosp-test-${Date.now()}`;
    const signupRes = await makeRequest('/v1/hospitals', 'POST', {
      id: hospitalId,
      name: 'Apex City Hospital',
      licenseId: 'LIC-APEX-101',
      email: 'contact@apexhospital.org',
      pricingTier: 3,
      totalAmbulanceFleet: 6,
      serviceTags: ['cardiac', 'trauma']
    });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.hospital).toBeDefined();
    expect(signupRes.body.hospital.id).toBe(hospitalId);

    const loginRes = await makeRequest('/v1/auth/login', 'POST', {
      emailOrPhone: 'contact@apexhospital.org',
      password: 'password123',
      role: 'hospital'
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('hospital');
    expect(loginRes.body.hospital.name).toBe('Apex City Hospital');
  });
});
