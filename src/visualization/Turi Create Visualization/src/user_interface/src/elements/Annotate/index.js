import React, { Component } from 'react';
import style from './index.module.scss';

import { Root } from 'protobufjs';
import messageFormat from '../../format/message';

import InfiniteScroll from './InfiniteScroll';
import StatusBar from './StatusBar';
import SingleImage from './SingleImage';
import LabelContainer from './LabelContainer';
import LabelModal from './LabelModal';
import ErrorBar from './ErrorBar';

const DEFAULT_NUM_EXPECTED = 10;
const CACHE_SIZE = 1000;

/* TODO: Indicator to Show how many Images were Annotated */
/* TODO: Render Labels on Images */

class Annotate extends Component {
  constructor(props){
    super(props);
    this.state = {
      infiniteScroll: false,
      hideAnnotated: false,
      labelModal: false,
      totalError: "",
      labelCreationError: null,
      incrementalCurrentIndex: 0,
      LabelModalValue: "",
      /* TODO: Labels will be Populated from MetaData */
      imageData:{},
      labels:[]
    }
  }

  componentDidMount() {
    
  }

  cleanCache = (start, end) => {
    if (Object.keys(this.state.imageData).length > CACHE_SIZE) {
      var sorted_keys = Object.keys(this.state.imageData).sort();
      var lower_bound = sorted_keys[0];
      var upper_bound = sorted_keys[sorted_keys.length - 1];

      var intermediate_check = parseInt(((end - start)/2), 10);
      if((Math.abs(intermediate_check - lower_bound)) > (Math.abs(intermediate_check - upper_bound))){
        var delete_keys = sorted_keys.slice(lower_bound, (lower_bound + (end - start)));
        const imgData = this.state.imageData;
        for(var x = 0; x < delete_keys.length; x++){
          delete imgData[delete_keys[x]];
        }
        this.setState({
          imageData: imgData
        });
      }else{
        var delete_keys = sorted_keys.slice((upper_bound - (end - start)), upper_bound);
        const imgData = this.state.imageData;
        for(var x = 0; x < delete_keys.length; x++){
          delete imgData[delete_keys[x]];
        }
        this.setState({
          imageData: imgData
        });
      }
    }
  }

  getData = (start, end) => {
    this.cleanCache(start, end);
    const root = Root.fromJSON(messageFormat);
    const ParcelMessage = root.lookupType("TuriCreate.Annotation.Specification.ClientRequest");
    const payload = {"getter": {"type": 0, "start": start, "end": end}};
    const err = ParcelMessage.verify(payload);
    if (err)
      throw Error(err);
    
    const message = ParcelMessage.create(payload);
    const buffer = ParcelMessage.encode(message).finish();
    const encoded = btoa(String.fromCharCode.apply(null, buffer));

    if (window.navigator.platform == 'MacIntel') {
      window.webkit.messageHandlers["scriptHandler"].postMessage({status: 'writeProtoBuf', message: encoded});
    } else {
      window.postMessageToNativeClient(encoded);
    }
  }

  setImageData = (key, value) => {
    var previousImageData = this.state.imageData;
    previousImageData[key] = value;
    this.setState({
      imageData: previousImageData
    });
  }

  clearError = () => {
    this.setState({
      totalError: ""
    });
  }

  updateIncrementalCurrentIndex = (index) => {
    this.setState({
      incrementalCurrentIndex: index
    })
  }

  handleEventLabelModalValue = (e) => {
    this.setState({
      LabelModalValue: e.target.value
    });
  }
  
  openLabelModal = () => {
    this.setState({
      labelCreationError: null,
      labelModal: true,
      LabelModalValue: ""
    });
  }

  closeLabelModal = () => {
    this.setState({
      labelCreationError: null,
      labelModal: false,
      LabelModalValue: ""
    });
  }

  createLabel = (label) => {
    const notDuplicateLabel = this.state.labels.map(l => (l.name != label))
                                            .reduce((acc, b) => (acc && b), true);

    if(!notDuplicateLabel){
      this.setState({
        labelCreationError: `${label} already exists as a label name`
      });
      return;
    }

    var mutatorLabels = this.state.labels;
    
    mutatorLabels.push({
      name: label,
      num_annotated: 0,
      num_expected: DEFAULT_NUM_EXPECTED
    });

    this.setState({
      labels: mutatorLabels,
      labelCreationError: null,
      labelModal: false,
      LabelModalValue: ""
    });
  }

  toggleInfiniteScroll = () => {
    this.setState({
      infiniteScroll: !this.state.infiniteScroll
    });
  }

  toggleHideAnnotated = () => {
    this.setState({
      hideAnnotated: !this.state.hideAnnotated
    });
  }

  setAnnotation = (rowIndex, labels) => {
    const root = Root.fromJSON(messageFormat);
    const ParcelMessage = root.lookupType("TuriCreate.Annotation.Specification.ClientRequest");
    const payload = {"annotations": {"annotation":[{"labels": [{"stringLabel": labels}], "rowIndex": [rowIndex]}]}};
    const err = ParcelMessage.verify(payload);
    
    if (err)
      throw Error(err);

    const message = ParcelMessage.create(payload);
    const buffer = ParcelMessage.encode(message).finish();
    const encoded = btoa(String.fromCharCode.apply(null, buffer));

    if (window.navigator.platform == 'MacIntel') {
      window.webkit.messageHandlers["scriptHandler"].postMessage({status: 'writeProtoBuf', message: encoded});
    } else {
      window.postMessageToNativeClient(encoded);
    }
  }

  renderMainContent = () => {
    if(this.state.infiniteScroll) {
      return (
        <InfiniteScroll numElements={this.props.total}
                        hideAnnotated={this.state.hideAnnotated}
                        incrementalCurrentIndex={this.state.incrementalCurrentIndex}
                        updateIncrementalCurrentIndex={this.updateIncrementalCurrentIndex.bind(this)}
                        imageData={this.state.imageData}
                        getData={this.getData.bind(this)} />
      );
    } else {
      return (
        <SingleImage src={this.state.imageData[this.state.incrementalCurrentIndex]}
                     getData={this.getData.bind(this)}
                     numElements={this.props.total}
                     incrementalCurrentIndex={this.state.incrementalCurrentIndex}
                     updateIncrementalCurrentIndex={this.updateIncrementalCurrentIndex.bind(this)}/>
      );
    }
  }

  renderModal = () => {
    if(this.state.labelModal){
      return(
        <LabelModal closeLabelModal={this.closeLabelModal.bind(this)}
                    createLabel={this.createLabel.bind(this)}
                    error={this.state.labelCreationError}
                    LabelModalValue={this.state.LabelModalValue}
                    handleEventLabelModalValue={this.handleEventLabelModalValue.bind(this)}/>
      )
    }
  }

  renderError = () => {
    if(this.state.totalError){
      return (<ErrorBar message={this.state.totalError}
                        clearError={this.clearError.bind(this)}/>);
    }
  }

  render() {
    return (
      <div className={style.Annotate}>
        {this.renderModal()}
        {this.renderError()}
        <div>
            {/* Add Annotated to Protobuf Message */}
            <StatusBar annotated={12}
                       total={this.props.total}
                       infiniteScroll={this.state.infiniteScroll}
                       toggleInfiniteScroll={this.toggleInfiniteScroll.bind(this)}
                       hideAnnotated={this.state.hideAnnotated}
                       toggleHideAnnotated={this.toggleHideAnnotated.bind(this)}/>

            {this.renderMainContent()}
        </div>
        <div className={style.leftBar}>
        <LabelContainer labels={this.state.labels}
                        incrementalCurrentIndex={this.state.incrementalCurrentIndex}
                        infiniteScroll={this.state.infiniteScroll}
                        setAnnotation={this.setAnnotation.bind(this)}
                        openLabelModal={this.openLabelModal.bind(this)}
                        closeLabelModal={this.closeLabelModal.bind(this)}/>
        </div>
      </div>
    );
  }
}

export default Annotate;