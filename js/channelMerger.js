class Merger extends Component {
  constructor(app,serializedData) {
    super(app,serializedData);

    
      
    
    this.node =  new ChannelMergerNode(this.app.actx,  {
        numberOfInputs: 4,
      });
    this.node.parent = this;

    this.createInputButtons();
  }

}
