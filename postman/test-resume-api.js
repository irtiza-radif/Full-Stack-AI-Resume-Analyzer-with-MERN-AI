const http = require('http');

// Step 1: Login
const loginData = JSON.stringify({email: 'testuser@example.com', password: 'password123'});
const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData)}
};

const loginReq = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('=== STEP 1: LOGIN ===');
    console.log('Status:', res.statusCode);
    console.log('Body:', body);

    // Extract cookie
    const cookies = res.headers['set-cookie'] || [];
    let arrToken = '';
    cookies.forEach(c => {
      const match = c.match(/arr_token=([^;]+)/);
      if (match) arrToken = match[1];
    });
    console.log('arr_token:', arrToken ? arrToken.substring(0, 20) + '...' : 'NOT FOUND');

    if (!arrToken) {
      console.log('No arr_token found, aborting');
      return;
    }

    // Step 2: Upload resume
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    const pdfContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 1 0 R >>\nstartxref\n9\n%%EOF';

    let formBody = '';
    formBody += '--' + boundary + '\r\n';
    formBody += 'Content-Disposition: form-data; name="file"; filename="test-resume.pdf"\r\n';
    formBody += 'Content-Type: application/pdf\r\n\r\n';
    formBody += pdfContent + '\r\n';
    formBody += '--' + boundary + '--\r\n';

    const uploadOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/resumes',
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': Buffer.byteLength(formBody),
        'Cookie': 'arr_token=' + arrToken
      }
    };

    const uploadReq = http.request(uploadOptions, (res2) => {
      let body2 = '';
      res2.on('data', d => body2 += d);
      res2.on('end', () => {
        console.log('\n=== STEP 2: UPLOAD RESUME ===');
        console.log('Status:', res2.statusCode);
        console.log('Body:', body2);

        let resumeId = '';
        try {
          const parsed = JSON.parse(body2);
          resumeId = parsed._id || (parsed.resume && parsed.resume._id) || (parsed.data && parsed.data._id) || '';
        } catch(e) {}
        console.log('Resume ID:', resumeId);

        // Step 3: Get all resumes
        const getAllOptions = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/resumes',
          method: 'GET',
          headers: {'Cookie': 'arr_token=' + arrToken}
        };

        const getAllReq = http.request(getAllOptions, (res3) => {
          let body3 = '';
          res3.on('data', d => body3 += d);
          res3.on('end', () => {
            console.log('\n=== STEP 3: GET ALL RESUMES ===');
            console.log('Status:', res3.statusCode);
            console.log('Body:', body3);

            // Step 4: Get by ID
            if (!resumeId) {
              try {
                const parsed = JSON.parse(body3);
                const arr = Array.isArray(parsed) ? parsed : (parsed.resumes || parsed.data || []);
                if (arr.length > 0) resumeId = arr[0]._id;
              } catch(e) {}
            }

            if (!resumeId) {
              console.log('\n=== STEP 4: GET RESUME BY ID ===');
              console.log('No resume ID available, skipping');
              return;
            }

            const getByIdOptions = {
              hostname: 'localhost',
              port: 5000,
              path: '/api/resumes/' + resumeId,
              method: 'GET',
              headers: {'Cookie': 'arr_token=' + arrToken}
            };

            const getByIdReq = http.request(getByIdOptions, (res4) => {
              let body4 = '';
              res4.on('data', d => body4 += d);
              res4.on('end', () => {
                console.log('\n=== STEP 4: GET RESUME BY ID ===');
                console.log('Status:', res4.statusCode);
                console.log('Body:', body4);
              });
            });
            getByIdReq.on('error', e => console.log('Step 4 error:', e.message));
            getByIdReq.end();
          });
        });
        getAllReq.on('error', e => console.log('Step 3 error:', e.message));
        getAllReq.end();
      });
    });
    uploadReq.on('error', e => console.log('Step 2 error:', e.message));
    uploadReq.write(formBody);
    uploadReq.end();
  });
});
loginReq.on('error', e => console.log('Step 1 error:', e.message));
loginReq.write(loginData);
loginReq.end();
