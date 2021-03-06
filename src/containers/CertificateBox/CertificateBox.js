import React, { Component } from 'react';
import { Helmet } from "react-helmet";
import SignerBox from './SignerBox';
import './CertificateBox.css';
import { network, certOrder, AUTHORITY_STATUS_ENUM } from '../../env';

const QRCode = require('qrcode');
const ethers = require('ethers');

export default class extends Component {
  state = {
    validCertificate: (this.props.validCertificate&&this.props.validCertificate[0]) || null,
    isAlreadyRegistered: null,
    certificateObj: {
      ...this.props.certificateObj,
      signerStatusArray: new Array(this.props.certificateObj.signatures.length).fill(null)
    },
    showAllSigners: false
  };

  intervalId = null;
  previousPropsCertObj = this.props.certificateObj;

  componentDidMount = async() => {
    this.intervalId = setInterval(() => {
      if(this.props.validCertificate && this.state.validCertificate !== this.props.validCertificate[0]) {
        this.setState({ validCertificate: this.props.validCertificate[0] });
      }
      if(this.previousPropsCertObj !== this.props.certificateObj) {
        this.setState({
          certificateObj: {
            ...this.props.certificateObj,
            signerStatusArray: new Array(this.props.certificateObj.signatures.length).fill(null)
          }
        });
        this.previousPropsCertObj = this.props.certificateObj;
      }
    }, 100);
    
    if(this.props.qrDisplay) QRCode.toCanvas(document.getElementById('qrcode-canvas'), window.location.href);

    const certificate = await window.certificateContractInstance.certificates(this.state.certificateObj.certificateHash);

    this.setState({ isAlreadyRegistered: certificate.signers !== '0x' });
  };

  componentWillUnmount = () => {
    clearInterval(this.intervalId);
  }

  render = () => {
    const pc = this.state.certificateObj.parsedCertificate;
    const numberOfUnverifiedSigners = this.state.certificateObj.signerStatusArray.filter(status => {
      if(status !== null && status !== AUTHORITY_STATUS_ENUM.AUTHORISED) return true;
      return false;
    }).length;
    return (
      <div className="certificate-box" id="printable">
        <Helmet>
          <title>{pc.name} is certified on Blockchain</title>
          <meta
            name="description"
            content="View certifications on blockchain"
          />
        </Helmet>
        <div className="certificate-container">
          {this.props.preview ? <p className="preview">{this.state.isAlreadyRegistered ? <>Seems that this certificate is already registered and available at <a style={{cursor: 'pointer'}} onClick={() => this.props.history.push(`view-certificate/${this.state.certificateObj.certificateHash}`)}>https://kmpards.github.io/certidapp/view-certificate/{this.state.certificateObj.certificateHash}</a>. The smart contract will again accept this certificate only if there are more signers otherwise it will raise an exception.</> : <>{(this.state.certificateObj.signatures ? this.state.certificateObj.signatures.length : 0) ? <>Note: This is only a preview of the certificate, please register the certificate.</> : <>This is a preview of the entered certificate hex data.</>}</>}</p> : null}
          {pc.category ? <p className="category">Certificate of <span className="category mono">{pc.category}</span></p> : null}

          <p className="category-subtext">{!pc.category ? <>This certificate </> : null}is awarded{pc.name ? <> to</> : null}</p>

          {pc.name ? <p className="name mono">{pc.name}</p> : null}

          {
            pc.score || pc.subject || pc.date || pc.datetime
            ? <p>{pc.score || pc.subject || pc.category ? <>For </> : null}{
              pc.category || pc.score
              ? <>{
                pc.score !== null
                ? <>Acheiving <span className="score mono">{pc.score}%</span></>
                : <>Extraordinary</>
              } <span className="mono">{pc.category}</span> {
                pc.subject
                ? <>{
                  pc.name
                  ? <>in</>
                  : <>of</>
                } </>
                : null
              }<span className="subject mono">{pc.subject}</span></>
              : null
            }{
              (() => {
                const date = pc.datetime
                  || pc.date;
                const date2 = pc.datetime2
                  || pc.date2;
                const DateEl = props => <span className="date mono">{props.children}</span>
                if(date && date2) {
                  return <> from <DateEl>{date}</DateEl> to <DateEl>{date2}</DateEl></>;
                } else if(date && !date2) {
                  return <> on <DateEl>{date}</DateEl></>;
                } else if(!date && date2) {
                  return <> till <DateEl>{date2}</DateEl></>
                } else {
                  return null;
                }
              })()
            }{
              pc.location
              ? <> at <span className="location mono">{pc.location}</span></>
              : null
            }.</p>
            : null
          }

          {Object.keys(pc).filter(key => ![...certOrder, 'date', 'date2', 'location'].includes(key)).map(key => (
            <p key={'cert-'+key} className={key}>{key}: {pc[key]}</p>
          ))}


          <p>{this.state.validCertificate === (this.state.certificateObj.signatures ? this.state.certificateObj.signatures.length : 0)
            ? <>The above certificate information is signed by following <span className="mono">{this.state.validCertificate}</span> <span className="mono">signer{this.state.validCertificate > 1 ? <>s</>:null}
            </span> which is cryptographically verified by the certificate smart contract.</>
            : (
              0 < this.state.validCertificate
              && this.state.validCertificate < (this.state.certificateObj.signatures ? this.state.certificateObj.signatures.length : 0)
              ? <>{this.props.preview ? <>Seems that t</> : <>T</>}his certificate is signed by{this.props.preview ? <> only</> : null} {this.state.validCertificate} verified signer{this.state.validCertificate > 1 ? <>s</> : null} out of {this.state.certificateObj.signatures ? this.state.certificateObj.signatures.length : 0} total signers{this.props.preview ? <>, you can remove signatures of unverified signers</> : null}.</>
              : <>There are no KYC verified signers on this certificate.</>
            )}</p>

          {(this.state.certificateObj.signatures ? this.state.certificateObj.signatures.length : 0)
          ? <>
            {this.state.certificateObj.signatures.filter((sign, i) => {
              if(this.state.showAllSigners) return true;
              const status = this.state.certificateObj.signerStatusArray[i];
              if(status === null || status === AUTHORITY_STATUS_ENUM.AUTHORISED) return true;
              return false;
            }).map((signature, i) => (
              <SignerBox
                key={'signer-'+i}
                serial={i+1}
                certificateHash={this.state.certificateObj.certificateHash}
                signature={signature}
                validCertificate={this.props.validCertificate || [this.state.validCertificate, newStatus => this.setState({ validCertificate: newStatus })]}
                updateStatus={newStatus => {
                  const signerStatusArray = [...this.state.certificateObj.signerStatusArray];
                  signerStatusArray[i] = newStatus;
                  this.setState({
                    certificateObj: {
                      ...this.state.certificateObj,
                      signerStatusArray
                    }
                  });
                }}
                />
            ))}
          </>
          : null}

          {!this.state.showAllSigners && numberOfUnverifiedSigners ? <p onClick={() => this.setState({ showAllSigners: true })} style={{cursor: 'pointer'}}>[Show {numberOfUnverifiedSigners} unverified signer{numberOfUnverifiedSigners > 1 ? <>s</>:null}]</p> : null}

          {(() => {
            let content = (
              <>
              <p className="hash">Certificate Hash: <span className="mono">{this.state.certificateObj.certificateHash}</span></p>
              {this.state.certificateObj.txHashArray ? <p>Created at transaction{this.state.certificateObj.txHashArray.length > 1 ? <>s</> : null}
              {this.state.certificateObj.txHashArray.map(txHash => (
                <span key={'txHash-'+txHash}><br />
                  <span className="mono">{txHash.slice(0,6)}</span>...<span className="mono">{txHash.slice(62)}</span>. <a className="link-black" target="_blank" rel="noopenner noreferrer" href={`https://${network === 'homestead' ? '' : network+'.'}etherscan.io/tx/${txHash}`}>View on EtherScan</a></span>
              ))}
              </p> : null}
                </>
            );

            if(this.props.qrDisplay) {
              content = (
                <div className="row">
                  <div className="column1">
                    {content}
                  </div>
                  <div className="column2">
                    <div className="qrcode-canvas-container">
                    <canvas id="qrcode-canvas" />
                    </div>
                  </div>
                </div>
              );
            }

            return content;
          })()}
        </div>
      </div>
    );
  }
}
