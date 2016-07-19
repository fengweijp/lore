import React from 'react';
import randomColor from 'randomcolor';

@lore.connect(function(getState, props) {
  return {
    color: getState('color.byId', {
      id: props.params.colorId
    })
  }
})
class Guessatron extends React.Component {

  static propTypes = {
    color: React.PropTypes.object.isRequired
  };

  getStyles() {
    return {
      media: {
        height: '64px',
        width: '64px',
        backgroundColor: randomColor()
      }
    }
  }

  render() {
    const color = this.props.color;
    const styles = this.getStyles();

    return (
      <div>
        <h2>Guessatron Result</h2>
        <div className="media">
          <div className="media-left">
            <a href="#">
              <div className="media-object" style={styles.media} />
            </a>
          </div>
          <div className="media-body">
            <h4 className="media-heading">{color.data.name}</h4>
            <em>Is this your color?</em>
            <div>I hope it is because it's the only color I know.</div>
          </div>
        </div>
      </div>
    );
  }

}

export default Guessatron;