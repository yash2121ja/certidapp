import React, { Component } from 'react';
import { Helmet } from "react-helmet";
// import { certificateContract } from '../../env';
import CSVReader from './CSVReader';

const ethers = require('ethers');

const CURRENT_PAGE_ENUM = {
  SELECT_MODE: 0,
  SIGN_FRESH_CERTIFICATE: 1,
  SIGN_ENCODED_CERTIFICATE: 2,
  SIGN_CSV: 3
};

export default class extends Component {
  state = {
    currentScreen: CURRENT_PAGE_ENUM.SELECT_MODE,
    name: '',
    course: '',
    score: '',
    extraData: '',
    encodedCertificate: '',
    isAuthorised: true,
    certificatesToSign: [],
    errorsInCSV: '',
    csvSigning: false,
    certificatesSigned: []
  };

  componentDidMount = async() => {
    try {
      const certifyingAuthority = await window.certificateContractInstance.functions.certifyingAuthorities(await window.signer.getAddress());

      if(!certifyingAuthority.isAuthorised) {
        this.setState({ isAuthorised: false });
      }
    } catch(error) {
      console.error(error);
      setTimeout(this.componentDidMount, 1000);
    }
  }

  signThisCertificate = async() => {
    try {
      const nameBytes32 = window._z.stringToBytes32(this.state.name);
      const qualificationBytes32 = window._z.encodeQualification(
        this.state.course,
        +this.state.score
      );
      const extraData = ethers.utils.hexlify(this.state.extraData || '0x');
      if(extraData.length > 66) throw new Error('Extra Data Overflow, limit is 32 bytes');
      const extraDataBytes32 = ethers.utils.hexZeroPad(extraData, 32);

      const unsignedCertificateConcat = ethers.utils.hexlify(ethers.utils.concat([
        nameBytes32,
        qualificationBytes32,
        extraDataBytes32
      ]));

      const unsignedCertificateHash = ethers.utils.keccak256(
        ethers.utils.concat([ethers.utils.toUtf8Bytes('\x19Ethereum Signed Message:\n96'),unsignedCertificateConcat])
      );

      let signedCertificateConcat = unsignedCertificateConcat;

      const signature = await window.signer.signMessage(ethers.utils.arrayify(unsignedCertificateConcat));
      signedCertificateConcat = ethers.utils.concat([signedCertificateConcat, signature]);

      this.setState({
        encodedCertificate: ethers.utils.hexlify(signedCertificateConcat)
      });

      console.log('signed',ethers.utils.hexlify(signedCertificateConcat));
    } catch (error) {

    }
  };

  onTextAreaChange = event => {
    const spacesRemoved = event.target.value.split(' ').join('').split('\n').join('');
    // console.log(spacesRemoved);
    try {
      const certificateObj = window._z.parseCertificate(spacesRemoved);

      this.setState({
        certificateString: spacesRemoved,
        textAreaClass: 'valid',
        parsingWait: true,
        validCertificate: null
      });

      this.timeoutId = setTimeout(() => {
        this.setState({
          parsingWait: false,
          certificateObj
        });
      }, 500);
    } catch (error) {
      clearTimeout(this.timeoutId);
      this.setState({
        textAreaClass: 'invalid',
        parsingWait: false,
        certificateObj: null
      });
    }
  };

  onFileLoaded = output => {
    let errorsInCSV = '';
    // csv rows: name, course, percentile, extraData, concatOfOtherSignatures
    const certificatesToSign = output.split('\n').map((row, i) => {
      const details = row.split(',');
      // console.log(details);
      try {
        if(details.length < 4) throw new Error('Not enough entries');
        const nameBytes32 = window._z.stringToBytes32(details[0]);
        const qualificationBytes32 = window._z.encodeQualification(details[1],+details[2]);

        const extraData = ethers.utils.hexlify(details[3] || '0x');
        if(extraData.length > 66) throw new Error('Extra Data Overflow, limit is 32 bytes');
        const extraDataBytes32 = ethers.utils.hexZeroPad(extraData, 32);

        if(details[4] && details[4].slice(0,2) !== '0x') throw new Error('Invalid signatures, empty the column if no signature');

        const unsignedCertificate = ethers.utils.hexlify(ethers.utils.concat([
          nameBytes32,
          qualificationBytes32,
          extraDataBytes32
        ]));

        return {
          details,
          unsignedCertificate,
          signedCertificate: details[4] || unsignedCertificate
        };
      } catch (error) {
        errorsInCSV += `Error at row ${i+1}: ${error.message}\n`;
      }
    }).filter(entry => !!entry);
    console.log({certificatesToSign}, errorsInCSV);
    this.setState({ certificatesToSign, errorsInCSV });
  }

  render = () => {
    let screen;

    const header = (
      <p style={{textAlign: ''}}><button className="btn" onClick={() => this.setState({ currentScreen: CURRENT_PAGE_ENUM.SELECT_MODE })}>Go Back to Select Mode</button></p>
    );

    if(this.state.currentScreen === CURRENT_PAGE_ENUM.SELECT_MODE) {
      screen = (
        <>
          <button
            className="btn"
            onClick={() => this.setState({ currentScreen: CURRENT_PAGE_ENUM.SIGN_FRESH_CERTIFICATE })}
          >New Certificate</button>
          <button
            className="btn"
            onClick={() => this.setState({ currentScreen: CURRENT_PAGE_ENUM.SIGN_ENCODED_CERTIFICATE })}
          >Sign Encoded Certificate</button>
          <button
            className="btn"
            onClick={() => this.setState({ currentScreen: CURRENT_PAGE_ENUM.SIGN_CSV })}
          >CSV Mode</button>
        </>
      );
    } else if(this.state.currentScreen === CURRENT_PAGE_ENUM.SIGN_FRESH_CERTIFICATE) {
      screen = (
        <>
        {header}
        <div className="form-group">
          <p>Enter Name:</p>
          <input
            className="certificate-textinput"
            type="text"
            placeholder="Enter Certifiee Name (Max 30 chars)"
            onChange={event => this.setState({name: event.target.value})}/>
        </div>

        <div className="form-group">
          <p>Enter Course:</p>
          <input
            className="certificate-textinput"
            type="text"
            placeholder="Enter Certifiee Course (Max 30 chars)"
            maxLength="30"
            onChange={event => this.setState({course: event.target.value})}/>
        </div>

        <div className="form-group">
          <p>Enter Score:</p>
          <input
            className="certificate-textinput"
            type="text"
            placeholder="E.g. 74.89"
            onChange={event => this.setState({score: event.target.value})}/>
        </div>

        <div className="form-group">
          <p>Extra Data:</p>
          <input
            className="certificate-textinput"
            type="text"
            placeholder="Enter Hex String 0x or can leave empty"
            onChange={event => this.setState({extraData: event.target.value})}/>
        </div>

        <button className="btn" onClick={this.signThisCertificate}>Sign this Certificate</button>
        </>
      );
    } else if(this.state.currentScreen === CURRENT_PAGE_ENUM.SIGN_ENCODED_CERTIFICATE) {
      screen = (
        <>
        {header}
        <p>Paste an unsigned or signed certificate in the below box:</p>
        <textarea className={['certificate-textarea', this.state.textAreaClass].filter(className=>!!className).join(' ')} onChange={this.onTextAreaChange} />
        </>
      );
    } else if(this.state.currentScreen === CURRENT_PAGE_ENUM.SIGN_CSV) {
      screen = (
        <>
        {header}
          {this.state.certificatesToSign.length === 0
            ? <>
          <button className="btn" onClick={() => document.getElementById('csv-input').click()}>Select CSV file</button>
          <CSVReader
            inputId="csv-input"
            onFileLoaded={this.onFileLoaded}
            style={{display: 'none'}}
            onError={this.handleDarkSideForce}
          />
          </> : <>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Course</th>
                  <th>Score</th>
                  <th>Extra Data</th>
                  <th>Signed Certificate</th>
                </tr>
              </thead>
              <tbody>
              {this.state.certificatesToSign.map((obj,i) => (
                <tr key={'sign-'+i}>
                  <td>{obj.details[0]}</td>
                  <td>{obj.details[1]}</td>
                  <td>{obj.details[2]}</td>
                  <td>{obj.details[3]}</td>
                  <td>{obj.unsignedCertificate.slice(0,8)}...({(obj.unsignedCertificate.length + obj.signedCertificate.length - 4)/2} bytes)</td>
                </tr>
              ))}
              </tbody>
            </table>

            <p>Errors: {this.state.errorsInCSV}</p>

            <button className="btn" onClick={async() => {
              this.setState({ csvSigning: true });

              if(!window.signer) alert('Signer not available, please connect metamask');

              const arrayOfCertificatesSignedPromises = this.state.certificatesToSign.map(async obj => {
                const signature = await window.signer.signMessage(ethers.utils.arrayify(obj.unsignedCertificate));

                console.log(signature);
                return {
                  ...obj,
                  signedCertificate: ethers.utils.hexlify(ethers.utils.concat([
                    obj.signedCertificate,
                    signature
                  ]))
                };
              });

              await Promise.all(arrayOfCertificatesSignedPromises);

              const certificatesSigned = [];

              for(const promise of arrayOfCertificatesSignedPromises) {
                certificatesSigned.push(await promise);
              }

              console.log('certificatesSigned',certificatesSigned);
              this.setState({ certificatesSigned, csvSigning: false });
            }}>{this.state.csvSigning ? 'Signing' : 'Sign'} {this.state.certificatesToSign.length} certificates{this.state.csvSigning ? '...' : null}</button>
          </>}

          {this.state.certificatesSigned.length ? <>
            <button className="btn" onClick={() => {
              const text = 'Name,Course,Score,ExtraData,SignedCertificate\n'+this.state.certificatesSigned.map(c => {
                return [
                  c.details[0],
                  c.details[1],
                  c.details[2],
                  c.details[3],
                  c.signedCertificate
                ].join(',')
              }).join('\n');

              const element = document.createElement("a");
              const file = new Blob([text], {type: 'text/plain'});
              element.href = URL.createObjectURL(file);
              element.download = 'signed_certificates.csv' ; //"keystore.txt";
              document.body.appendChild(element); // Required for this to work in FireFox
              element.click();
            }}>Download updated CSV</button>
          </> : null}
        </>
      );
    }


    return (
      <>
        <Helmet>
          <title>Sign Certificate</title>
          <meta
            name="description"
            content="Sign Certificate which can be submitted to blockchain"
          />
        </Helmet>
        {!this.state.isAuthorised ? <p className="error-message">Looks like {window.userAddress} is not authorised as a certifying authority, hence the smart contract will not accept certificates signed by this private key.</p> : null}

        {screen}
      </>
    );
  }
}